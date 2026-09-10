// Product-specific, one-time report purchase store. This is the ONLY record that
// entitles a user to generate a paid report. Subscription tier and tarot
// entitlements are intentionally NOT consulted here.
//
// Lifecycle: pending -> paid -> consumed.
//   pending  : Stripe Checkout Session created (not yet paid)
//   paid     : payment confirmed by signed webhook (invariants verified) OR
//              server-side Stripe retrieval
//   consumed : the matching report was dispatched and correlated to a reading row
//
// Idempotency guarantees:
//   - stripe_session_id / stripe_payment_id are UNIQUE -> one payment = one purchase
//   - consumeReportPurchase() creates the reading row AND correlates the purchase
//     inside a single transaction (SELECT ... FOR UPDATE + conditional UPDATE), so
//     one paid purchase creates exactly one reading and dispatches exactly once.
//     A repeat request for an already-consumed purchase returns the existing
//     correlation (with the reading's ACTUAL status) WITHOUT creating a new reading.
import { query, transaction } from '@/lib/db';
import { LAUNCH_PAID_TYPES, gateGeneration } from '@/lib/launch/allowlist';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import crypto from 'crypto';

const KNOWN_INVALID_REPORT_ID = '6deeb156-4f6d-40e2-988d-a714ff966c39';
// Audited server-side correction profile; never accepted from a request body.
const CORRECTED_1160 = { timezone: 'America/Los_Angeles', latitude: 36.97412, longitude: -122.0308 } as const;

export type ReportPurchaseStatus = 'pending' | 'paid' | 'consumed' | 'failed';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a purchaseId is a real UUID BEFORE it touches the uuid column. */
export function isValidPurchaseId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}

export interface ReportPurchaseRow {
  id: number;
  purchaseId: string;
  userId: number;
  reportType: string;
  sku: string;
  amount: number;
  currency: string;
  status: ReportPurchaseStatus;
  stripeSessionId: string | null;
  stripePaymentId: string | null;
  readingId: number | null;
  reportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function hydrate(row: any): ReportPurchaseRow {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    userId: Number(row.user_id),
    reportType: row.report_type,
    sku: row.sku,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripe_session_id ?? null,
    stripePaymentId: row.stripe_payment_id ?? null,
    readingId: row.reading_id != null ? Number(row.reading_id) : null,
    reportId: row.report_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Validate the report_type/sku pairing server-side (defense against bad input). */
export function isValidSkuPair(reportType: string, sku: string): boolean {
  return sku === `report-${reportType}`;
}

export class ReportCheckoutConflictError extends Error {
  constructor(public readonly purchase: ReportPurchaseRow) {
    super('An active checkout or entitlement already exists for this report.');
    this.name = 'ReportCheckoutConflictError';
  }
}

/** Create one active pending purchase per user/product under a database lock. */
export async function createReportPurchase(input: {
  userId: number | string;
  reportType: string;
  sku: string;
  amount: number;
  currency?: string;
}): Promise<{ purchaseId: string }> {
  if (!isValidSkuPair(input.reportType, input.sku)) {
    throw new Error(`Invalid report_type/sku pairing: ${input.reportType}/${input.sku}`);
  }
  const result = await transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const lockKey = `${Number(input.userId)}:${input.reportType}`;
      await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
      // Stripe Checkout sessions expire after 24 hours by default. Retire only
      // older pending rows so an interrupted request can safely claim a new order
      // without leaving a still-payable session competing with it.
      await tx(
        `UPDATE report_orders SET status = 'failed', updated_at = now()
         WHERE user_id = $1 AND report_type = $2 AND status = 'pending'
           AND updated_at < now() - INTERVAL '25 hours'`,
        [Number(input.userId), input.reportType],
      );
      const existing = await tx(
        `SELECT * FROM report_orders
         WHERE user_id = $1 AND report_type = $2 AND status IN ('pending', 'paid', 'consumed')
         ORDER BY updated_at DESC LIMIT 1`,
        [Number(input.userId), input.reportType],
      );
      if (existing.rows.length > 0) {
        return finalize(tx, { existing: hydrate(existing.rows[0]) });
      }
      const inserted = await tx(
        `INSERT INTO report_orders (user_id, report_type, sku, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [Number(input.userId), input.reportType, input.sku, input.amount, input.currency ?? 'usd'],
      );
      return finalize(tx, { purchaseId: inserted.rows[0].purchase_id });
    } catch (err) {
      await tx('ROLLBACK');
      throw err;
    }
  });
  if (result.existing) throw new ReportCheckoutConflictError(result.existing);
  return { purchaseId: result.purchaseId };
}

/**
 * Verify a confirmed Stripe session against the stored order UNDER LOCK, then
 * mark paid only if every signed invariant matches. Returns a discriminated
 * result so the webhook can decide whether to defer (don't mark paid) vs apply.
 *
 * Verifies: client_reference_id/purchaseId, metadata.kind, metadata.userId,
 * metadata.reportType, metadata.sku, currency, and amount_total (incl. any
 * discount) equals the stored amount. Rejects/defers on mismatch or unpaid.
 */
export type VerifyPaidResult =
  | { outcome: 'applied' }
  | { outcome: 'deferred_unpaid' }
  | { outcome: 'deferred_mismatch'; reason: string }
  | { outcome: 'not_found' };

export async function verifyAndMarkReportPurchasePaid(input: {
  purchaseId: string;
  session: any;
}): Promise<VerifyPaidResult> {
  // Payment must be confirmed by Stripe, not just "session completed".
  const paymentStatus = input.session?.payment_status;
  const pi = input.session?.payment_intent;
  const piStatus = typeof pi === 'object' ? pi?.status : undefined;
  const paid = paymentStatus === 'paid' || piStatus === 'succeeded';
  if (!paid) {
    return { outcome: 'deferred_unpaid' };
  }

  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const lock = await tx(
        `SELECT id, user_id, report_type, sku, amount, currency, status, stripe_session_id
           FROM report_orders WHERE purchase_id = $1 FOR UPDATE`,
        [input.purchaseId],
      );
      if (lock.rows.length === 0) return finalize(tx, { outcome: 'not_found' });
      const r = lock.rows[0];

      const meta = input.session?.metadata ?? {};
      const expectAmount = Number(r.amount);
      const expectCurrency = String(r.currency).toUpperCase();
      const sessionCurrency = input.session?.currency;
      const rawSessionAmount = input.session?.amount_total ?? input.session?.amount;
      const sessionAmount = Number(rawSessionAmount);

      const mismatches: string[] = [];
      if (meta.kind !== 'report') mismatches.push('kind');
      if (String(meta.userId) !== String(r.user_id)) mismatches.push('userId');
      if (meta.reportType !== r.report_type) mismatches.push('reportType');
      if (meta.sku !== r.sku) mismatches.push('sku');
      // Currency + amount are REQUIRED and must match exactly (no missing/zero/NaN).
      if (typeof sessionCurrency !== 'string' || sessionCurrency.toUpperCase() !== expectCurrency) {
        mismatches.push('currency');
      }
      if (!Number.isFinite(sessionAmount) || !Number.isInteger(sessionAmount) || sessionAmount <= 0) {
        mismatches.push('amount');
      } else if (sessionAmount !== expectAmount) {
        mismatches.push('amount');
      }
      // Require a session id and, if we already recorded one, it must match.
      if (!input.session?.id) {
        mismatches.push('session_id');
      } else if (r.stripe_session_id && input.session.id !== r.stripe_session_id) {
        mismatches.push('session_id');
      }

      if (mismatches.length > 0) {
        return finalize(tx, { outcome: 'deferred_mismatch', reason: mismatches.join(',') });
      }

      const upd = await tx(
        `UPDATE report_orders
           SET status = 'paid',
               stripe_session_id = COALESCE($2, stripe_session_id),
               stripe_payment_id = COALESCE($3, stripe_payment_id),
               updated_at = now()
         WHERE purchase_id = $1 AND status IN ('pending', 'paid')
         RETURNING id`,
        [input.purchaseId, input.session?.id ?? null, pi?.id ?? input.session?.payment_intent ?? null],
      );
      return finalize(tx, upd.rows.length > 0 ? { outcome: 'applied' } : { outcome: 'applied' });
    } catch (err) {
      await tx('ROLLBACK');
      throw err;
    }
  });
}

export async function getReportPurchase(purchaseId: string): Promise<ReportPurchaseRow | null> {
  if (!isValidPurchaseId(purchaseId)) return null; // never hit the uuid column with garbage
  const { rows } = await query(
    `SELECT * FROM report_orders WHERE purchase_id = $1`,
    [purchaseId],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

export async function getReportPurchaseBySession(sessionId: string): Promise<ReportPurchaseRow | null> {
  const { rows } = await query(
    `SELECT * FROM report_orders WHERE stripe_session_id = $1`,
    [sessionId],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

export async function getReportPurchaseByReadingId(readingId: number | string): Promise<ReportPurchaseRow | null> {
  const { rows } = await query(
    `SELECT * FROM report_orders WHERE reading_id = $1`,
    [Number(readingId)],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

/**
 * Return a paid/consumed purchase for a given user + report type, if one exists.
 * Used by checkout to detect "already purchased" and by resume to validate ownership.
 */
export async function getReportPurchaseByUserIdAndType(userId: number | string, reportType: string): Promise<ReportPurchaseRow | null> {
  const { rows } = await query(
    `SELECT * FROM report_orders
     WHERE user_id = $1 AND report_type = $2 AND status IN ('paid', 'consumed')
     ORDER BY updated_at DESC LIMIT 1`,
    [Number(userId), reportType],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

export type ConsumeResult =
  | { outcome: 'consumed'; readingId: number; reportId: string; readingStatus: string; readingResult?: any }
  | { outcome: 'already_correlated'; readingId: number; reportId: string; readingStatus: string; readingResult?: any }
  | { outcome: 'not_found' }
  | { outcome: 'not_paid' }
  | { outcome: 'wrong_owner' }
  | { outcome: 'wrong_type' };

export interface ReadingInsert {
  userId: number;
  type: string;
  title: string;
  question: string;
  pricePaid: number;
  resultJson: string;
  pipelineStatus: string;
}

/**
 * Atomically consume a paid purchase AND create its reading row in one
 * transaction. This eliminates the race/orphan: the reading is created only when
 * the purchase is successfully correlated, so a losing concurrent request cannot
 * leave a dangling queued reading behind. A repeat for an already-consumed
 * purchase returns the EXISTING correlation with the reading's ACTUAL status
 * (never a hardcoded "queued").
 */
export async function consumeReportPurchase(input: {
  purchaseId: string;
  userId: number | string;
  reportType: string;
  reportId: string;
  reading: ReadingInsert;
}): Promise<ConsumeResult> {
  if (!isValidPurchaseId(input.purchaseId)) return { outcome: 'not_found' };

  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const lock = await tx(
        `SELECT id, user_id, report_type, status, reading_id, report_id
           FROM report_orders WHERE purchase_id = $1 FOR UPDATE`,
        [input.purchaseId],
      );
      if (lock.rows.length === 0) return finalize(tx, { outcome: 'not_found' });
      const r = lock.rows[0];

      if (Number(r.user_id) !== Number(input.userId)) return finalize(tx, { outcome: 'wrong_owner' });
      if (r.report_type !== input.reportType) return finalize(tx, { outcome: 'wrong_type' });

      // Already consumed -> return the EXISTING correlation with the reading's
      // ACTUAL pipeline status (so a failed dispatch is not misreported as queued).
      if (r.status === 'consumed' && r.reading_id != null) {
        const rdr = await tx(`SELECT pipeline_status FROM readings WHERE id = $1`, [Number(r.reading_id)]);
        const readingStatus = (rdr.rows[0]?.pipeline_status as string) ?? 'queued';
        const rdrRes = await tx(`SELECT result FROM readings WHERE id = $1`, [Number(r.reading_id)]);
        return finalize(tx, {
          outcome: 'already_correlated',
          readingId: Number(r.reading_id),
          reportId: r.report_id,
          readingStatus,
          readingResult: rdrRes.rows[0]?.result,
        });
      }
      if (r.status !== 'paid') return finalize(tx, { outcome: 'not_paid' });

      // Create the reading AND correlate it in the same transaction. The reportId
      // is supplied by the caller as the SINGLE source of truth and is stored in
      // both report_orders.report_id and the reading's result JSON (so the n8n
      // callback can locate the reading by the exact same reportId).
      const reportId = input.reportId;
      const ins = await tx(
        `INSERT INTO readings (user_id, type, title, question, price_paid, result, pipeline_status, created_at)
         VALUES ($1, 'report', $2, $3, $4, $5, $6, now())
         RETURNING id`,
        [
          Number(input.userId), input.reading.title, input.reading.question, input.reading.pricePaid,
          input.reading.resultJson, input.reading.pipelineStatus,
        ],
      );
      const readingId = Number(ins.rows[0].id);

      const upd = await tx(
        `UPDATE report_orders
           SET status = 'consumed', reading_id = $2, report_id = $3, updated_at = now()
         WHERE purchase_id = $1 AND status = 'paid' AND reading_id IS NULL`,
        [input.purchaseId, readingId, reportId],
      );
      if (upd.rowCount === 0) {
        // Lost a race: re-read to return whatever won. report_orders has no
        // pipeline_status column, so join readings to get the reading's actual status.
        const re = await tx(
          `SELECT o.reading_id, o.report_id, r.pipeline_status
             FROM report_orders o
             LEFT JOIN readings r ON r.id = o.reading_id
            WHERE o.purchase_id = $1`,
          [input.purchaseId],
        );
        if (re.rows[0]?.reading_id != null) {
          const reRes = await tx(`SELECT result FROM readings WHERE id = $1`, [Number(re.rows[0].reading_id)]);
          return finalize(tx, {
            outcome: 'already_correlated',
            readingId: Number(re.rows[0].reading_id),
            reportId: re.rows[0].report_id,
            readingStatus: (re.rows[0].pipeline_status as string) ?? 'queued',
            readingResult: reRes.rows[0]?.result,
          });
        }
        return finalize(tx, { outcome: 'not_paid' });
      }
      return finalize(tx, { outcome: 'consumed', readingId, reportId, readingStatus: input.reading.pipelineStatus, readingResult: input.reading.resultJson });
    } catch (err) {
      await tx('ROLLBACK');
      throw err;
    }
  });
}

// (3) Atomic, stateful retry claim. A retry keeps the same readings row (the
// user's report card) but creates one new correlation attempt in result.retryAttempts.
// Two concurrent retries race here: exactly one wins the conditional UPDATE.
export async function claimRetry(
  readingId: number | string,
  userId: number | string,
  retryReportId = crypto.randomUUID(),
): Promise<{ claimed: boolean; reportId: string; attempt?: number }> {
  // Only a terminal DISPATCH failure is customer-retryable. A quality "rejected"
  // (judge decision via callback) is terminal and must NOT let a customer regenerate
  // at no charge; that requires a separate privileged editor/admin rework action.
  const upd = await query(
    `UPDATE readings
       SET pipeline_status = 'queued',
           result = jsonb_set(
             jsonb_set(result, '{reportId}', to_jsonb($3::text), true),
             '{retryAttempts}',
             COALESCE(result->'retryAttempts', '[]'::jsonb) ||
               jsonb_build_array(jsonb_build_object(
                 'attempt', jsonb_array_length(COALESCE(result->'retryAttempts', '[]'::jsonb)) + 2,
                 'reportId', $3::text,
                 'previousReportId', result->>'reportId',
                 'requestedAt', now()
               )),
             true
           )
     WHERE id = $1 AND user_id = $2 AND pipeline_status = 'dispatch_failed'
     RETURNING result`,
    [Number(readingId), Number(userId), retryReportId],
  );
  if ((upd.rowCount ?? 0) === 0) return { claimed: false, reportId: retryReportId };
  const result = upd.rows[0]?.result as Record<string, unknown> | undefined;
  const attempts = Array.isArray(result?.retryAttempts) ? result.retryAttempts : [];
  return { claimed: true, reportId: retryReportId, attempt: attempts.length + 1 };
}

// Restore a failed dispatch to the terminal dispatch_failed state (distinct from a
// quality rejection). Used when a retry's n8n call itself fails.
export async function markReadingDispatchFailed(readingId: number | string): Promise<void> {
  await query(
    `UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1`,
    [Number(readingId)],
  );
}

export interface PipelineFailureEvidence {
  reportId: string;
  executionId: string;
  failedNode: string;
  failedAt: string;
  status: 'failed';
}

/** Only trusted server callbacks may submit this evidence. Time alone is NEVER
 * evidence of failure. No stack, prompt, birth data, or arbitrary URLs are stored.
 */
export function isPipelineFailureEvidence(value: unknown): value is PipelineFailureEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every((key) => ['reportId', 'executionId', 'failedNode', 'failedAt', 'status'].includes(key)) &&
    isValidPurchaseId(v.reportId) && typeof v.executionId === 'string' && /^[1-9][0-9]{0,19}$/.test(v.executionId) &&
    typeof v.failedNode === 'string' && v.failedNode.trim().length > 0 && v.failedNode.length <= 120 &&
    v.status === 'failed' && typeof v.failedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.failedAt) && Number.isFinite(Date.parse(v.failedAt));
}

export async function recordPipelineFailure(input: unknown): Promise<'applied' | 'duplicate' | 'conflict' | 'not_found' | 'invalid'> {
  if (!isPipelineFailureEvidence(input)) return 'invalid';
  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const lock = await tx(`SELECT *, now() AS observed_at FROM readings WHERE type = 'report' AND result->>'reportId' = $1 FOR UPDATE`, [input.reportId]);
      const r = lock.rows[0];
      if (!r) return finalize(tx, 'not_found');
      const lastRetry = r.result.retryAttempts?.at(-1)?.requestedAt;
      const start = Date.parse(r.result.attemptStartedAt ?? lastRetry ?? r.created_at);
      const failedAt = Date.parse(input.failedAt);
      const now = new Date(r.observed_at).getTime();
      if (!['queued', 'processing'].includes(r.pipeline_status) || !Number.isFinite(start) ||
          failedAt < start || failedAt > now || failedAt < now - 7 * 24 * 60 * 60 * 1000) return finalize(tx, 'conflict');
      const prior = r.result.failureEvidence;
      if (prior) return finalize(tx, Object.keys(input).every((key) => prior[key] === input[key as keyof PipelineFailureEvidence]) ? 'duplicate' : 'conflict');
      await tx(`UPDATE readings SET result = jsonb_set(result, '{failureEvidence}', $2::jsonb) WHERE id = $1`,
        [r.id, JSON.stringify({ ...input, receivedAt: new Date(now).toISOString(), source: 'authenticated_pipeline' })]);
      return finalize(tx, 'applied');
    } catch (error) {
      await tx('ROLLBACK');
      throw error;
    }
  });
}

/** Privileged callers only: authorization is enforced by the rework route.
 * Lock the order before the reading, matching consumeReportPurchase's lock order.
 * The existing paid entitlement is never reopened and no billing API is called.
 */
type SnapshotCorrection = {
  birthData: { firstName?: string; dob: string; birthTime: string | null; place: string; lat: number; lon: number; tz: string; solarFallback: boolean };
  verifiedFacts: any;
};

export type SnapshotCorrectionPreview =
  | { outcome: 'preview'; oldReportId: string; digest: string; snapshot: SnapshotCorrection }
  | { outcome: 'conflict' | 'not_found' | 'invalid_snapshot' | 'missing_snapshot' };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

function correctionDigest(snapshot: SnapshotCorrection): string {
  return crypto.createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}

async function build1160Correction(row: any): Promise<SnapshotCorrection | null> {
  if (row?.result?.reportId !== KNOWN_INVALID_REPORT_ID) return null;
  const old = row.result?.metadata; const b = old?.birthData;
  if (!b || typeof b.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.dob) || typeof b.place !== 'string' || !b.place.trim() ||
      (b.birthTime !== null && (typeof b.birthTime !== 'string' || !/^\d{2}:\d{2}$/.test(b.birthTime)))) return null;
  if (!row.result?.reportType || !old.verifiedFacts?.asOfDate) return null;
  const birth = { name: typeof b.firstName === 'string' ? b.firstName : undefined, date: b.dob, time: b.birthTime || undefined,
    location: b.place, timezone: CORRECTED_1160.timezone, latitude: CORRECTED_1160.latitude, longitude: CORRECTED_1160.longitude,
    unknownTime: Boolean(b.solarFallback) };
  const built = await buildVerifiedFactsForReport(row.result.reportType, birth, old.verifiedFacts.asOfDate);
  if (!built.ok) return null;
  return { birthData: { firstName: birth.name, dob: birth.date, birthTime: birth.time || null, place: birth.location,
    lat: CORRECTED_1160.latitude, lon: CORRECTED_1160.longitude, tz: CORRECTED_1160.timezone, solarFallback: birth.unknownTime }, verifiedFacts: built.ledger };
}

export async function previewPaidSnapshotCorrection(readingId: number, expectedReportId: string): Promise<SnapshotCorrectionPreview> {
  const { rows } = await query("SELECT * FROM readings WHERE id = $1 AND type = 'report'", [readingId]);
  const row = rows[0];
  if (!row) return { outcome: 'not_found' };
  if (row.result?.reportId !== expectedReportId) return { outcome: 'conflict' };
  if (row.result?.reportId !== KNOWN_INVALID_REPORT_ID) return { outcome: 'invalid_snapshot' };
  const snapshot = await build1160Correction(row);
  if (!snapshot) return { outcome: 'missing_snapshot' };
  return { outcome: 'preview', oldReportId: expectedReportId, digest: correctionDigest(snapshot), snapshot };
}

export async function approvePaidSnapshotCorrection(input: {
  readingId: number; expectedReportId: string; digest: string; reportId: string; actorId: number; reason: string;
}): Promise<{ outcome: 'claimed'; reportId: string; reportType: string; snapshot: SnapshotCorrection } | { outcome: 'conflict' | 'not_found' | 'not_entitled' | 'invalid_snapshot' | 'missing_snapshot' }> {
  const preview = await previewPaidSnapshotCorrection(input.readingId, input.expectedReportId);
  if (preview.outcome !== 'preview') return preview;
  if (!/^[a-f0-9]{64}$/.test(input.digest) || input.digest !== correctionDigest(preview.snapshot)) return { outcome: 'conflict' };
  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const orders = await tx('SELECT * FROM report_orders WHERE reading_id = $1 FOR UPDATE', [input.readingId]);
      const readings = await tx('SELECT * FROM readings WHERE id = $1 FOR UPDATE', [input.readingId]);
      const o = orders.rows[0]; const r = readings.rows[0];
      if (!r || orders.rows.length !== 1 || !o || o.status !== 'consumed' || r.type !== 'report' || Number(o.user_id) !== Number(r.user_id) ||
          o.report_id !== input.expectedReportId || r.result?.reportId !== KNOWN_INVALID_REPORT_ID || !LAUNCH_PAID_TYPES.includes(o.report_type) ||
          !gateGeneration(o.report_type, r.user_id).allowed || !isValidSkuPair(o.report_type, o.sku) || Number(o.amount) <= 0 || !o.stripe_session_id || !o.stripe_payment_id) {
        return finalize(tx, { outcome: 'not_entitled' });
      }
      if (!['queued', 'processing'].includes(r.pipeline_status) || !isValidPurchaseId(input.reportId) || input.reportId === input.expectedReportId) return finalize(tx, { outcome: 'conflict' });
      // Rebuild from the locked row, rather than trusting the earlier preview.
      // This closes the preview/approval race and makes the digest bind to the
      // exact immutable civil-input source that is being replaced.
      const lockedSnapshot = await build1160Correction(r);
      if (!lockedSnapshot || correctionDigest(lockedSnapshot) !== input.digest) return finalize(tx, { outcome: 'conflict' });
      const { reworkHistory = [], ...previousResult } = r.result; const now = new Date().toISOString();
      const result = { ...r.result, reportId: input.reportId, metadata: lockedSnapshot, verifiedFacts: lockedSnapshot.verifiedFacts,
        pipeline: { status: 'queued' }, attemptStartedAt: now,
        reworkHistory: [...reworkHistory, { kind: 'snapshot_correction', reportId: input.expectedReportId, status: r.pipeline_status,
          callbackHash: r.pipeline_callback_hash, result: previousResult, actorId: input.actorId, reason: input.reason, requestedAt: now,
          replacementDigest: input.digest, correction: CORRECTED_1160 }] };
      await tx(`UPDATE readings SET result = $2::jsonb, pipeline_status = 'queued', pipeline_callback_hash = NULL WHERE id = $1`, [input.readingId, JSON.stringify(result)]);
      await tx('UPDATE report_orders SET report_id = $2, updated_at = now() WHERE id = $1', [o.id, input.reportId]);
      return finalize(tx, { outcome: 'claimed', reportId: input.reportId, reportType: o.report_type, snapshot: lockedSnapshot });
    } catch (error) { await tx('ROLLBACK'); throw error; }
  });
}

export async function claimPaidRework(input: {
  readingId: number;
  expectedReportId: string;
  reportId: string;
  actorId: number;
  reason: string;
}): Promise<
  | { outcome: 'claimed'; reportId: string; reportType: string; ownerId: number; snapshot: any }
  | { outcome: 'conflict' | 'not_entitled' | 'missing_snapshot' | 'invalid_snapshot' }
> {
  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const orders = await tx('SELECT * FROM report_orders WHERE reading_id = $1 FOR UPDATE', [input.readingId]);
      const readings = await tx('SELECT * FROM readings WHERE id = $1 FOR UPDATE', [input.readingId]);
      const o = orders.rows[0];
      const r = readings.rows[0];
      if (!r || orders.rows.length !== 1 || !o || o.status !== 'consumed' || r.type !== 'report' ||
          Number(o.user_id) !== Number(r.user_id) || o.report_type !== r.result?.reportType ||
          !LAUNCH_PAID_TYPES.includes(o.report_type) || !gateGeneration(o.report_type, r.user_id).allowed ||
          !isValidSkuPair(o.report_type, o.sku) || Number(o.amount) <= 0 ||
          !o.stripe_session_id || !o.stripe_payment_id) {
        return finalize(tx, { outcome: 'not_entitled' });
      }
      const evidence = r.result.failureEvidence;
      const evidencedFailure = ['queued', 'processing'].includes(r.pipeline_status) &&
        evidence?.source === 'authenticated_pipeline' && evidence.reportId === input.expectedReportId && evidence.status === 'failed';
      if (r.result.reportId !== input.expectedReportId || o.report_id !== input.expectedReportId ||
          !isValidPurchaseId(input.reportId) || input.reportId === input.expectedReportId ||
          (!['rejected', 'dispatch_failed'].includes(r.pipeline_status) && !evidencedFailure)) {
        return finalize(tx, { outcome: 'conflict' });
      }
      // Incident quarantine: reading 1160's immutable facts have a known wrong
      // UTC conversion. A prose retry cannot repair them. Key by correlation,
      // not environment-specific row ID; keep blocked pending an audited rebuild.
      if (r.result.reportId === KNOWN_INVALID_REPORT_ID) {
        return finalize(tx, { outcome: 'invalid_snapshot' });
      }
      const snapshot = r.result.metadata;
      if (!snapshot?.birthData || !snapshot?.verifiedFacts) return finalize(tx, { outcome: 'missing_snapshot' });
      const { reworkHistory = [], ...previousResult } = r.result;
      const now = new Date().toISOString();
      const result = {
        reportId: input.reportId, reportType: o.report_type, metadata: snapshot,
        pipeline: { status: 'queued' }, attemptStartedAt: now,
        reworkHistory: [...reworkHistory, {
          reportId: input.expectedReportId, status: r.pipeline_status,
          callbackHash: r.pipeline_callback_hash, result: previousResult,
          actorId: input.actorId, reason: input.reason, requestedAt: now,
        }],
      };
      await tx(`UPDATE readings SET result = $2::jsonb, pipeline_status = 'queued', pipeline_callback_hash = NULL WHERE id = $1`,
        [input.readingId, JSON.stringify(result)]);
      await tx('UPDATE report_orders SET report_id = $2, updated_at = now() WHERE id = $1', [o.id, input.reportId]);
      return finalize(tx, { outcome: 'claimed', reportId: input.reportId, reportType: o.report_type, ownerId: Number(r.user_id), snapshot });
    } catch (error) {
      await tx('ROLLBACK');
      throw error;
    }
  });
}

async function finalize(
  tx: (t: string, p?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>,
  outcome: any,
): Promise<any> {
  // A "not_found"/"wrong_*"/"not_paid" result is still a successful, expected
  // business outcome (no DB error) -> commit the (no-op) transaction.
  await tx('COMMIT');
  return outcome;
}
