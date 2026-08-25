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
import crypto from 'crypto';

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

/** Create a pending purchase row. Returns the app-generated purchaseId. */
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
  const { rows } = await query(
    `INSERT INTO report_orders (user_id, report_type, sku, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING purchase_id`,
    [Number(input.userId), input.reportType, input.sku, input.amount, input.currency ?? 'usd'],
  );
  return { purchaseId: rows[0].purchase_id };
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
        // Lost a race: re-read to return whatever won.
        const re = await tx(`SELECT reading_id, report_id, pipeline_status FROM report_orders WHERE purchase_id = $1`, [input.purchaseId]);
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

// (3) Atomic, stateful retry claim. Transitions a terminal dispatch-failed /
// rejected reading back to 'queued' ONLY if it is currently in a retryable state,
// using a single conditional UPDATE ... RETURNING. Two concurrent retries race here:
// exactly one wins the row, the other gets 0 rows and must return 409.
export async function claimRetry(readingId: number | string, userId: number | string): Promise<{ claimed: boolean }> {
  const upd = await query(
    `UPDATE readings
       SET pipeline_status = 'queued'
     WHERE id = $1 AND user_id = $2 AND pipeline_status IN ('dispatch_failed', 'rejected')
     RETURNING id`,
    [Number(readingId), Number(userId)],
  );
  return { claimed: (upd.rowCount ?? 0) > 0 };
}

// Restore a failed dispatch to the terminal dispatch_failed state (distinct from a
// quality rejection). Used when a retry's n8n call itself fails.
export async function markReadingDispatchFailed(readingId: number | string): Promise<void> {
  await query(
    `UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1`,
    [Number(readingId)],
  );
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
