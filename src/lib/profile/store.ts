import { query, transaction } from '@/lib/db';
import crypto from 'crypto';

// Unified journal store for the Profile Hub. All non-tarot artifacts
// (reports, horoscopes, zoom sessions) live in `readings` with a `type`
// discriminator. Tarot keeps using @/lib/tarot/store (same table).

export type ReadingType = 'tarot' | 'report' | 'horoscope' | 'zoom_session';

export interface SaveUniversalReadingInput {
  userId: number;
  type: ReadingType;
  title?: string;
  question?: string;
  category?: string;
  scope?: string;
  periodStart?: string;
  periodEnd?: string;
  pricePaid?: number;
  partnerLabel?: string;
  result: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface UniversalReadingRecord {
  id: number;
  userId: number;
  type: ReadingType;
  title: string | null;
  question: string | null;
  category: string | null;
  scope: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pricePaid: number | null;
  partnerLabel: string | null;
  result: Record<string, unknown>;
  reflection: string | null;
  createdAt: string;
  /** Async n8n pipeline lifecycle state; null until dispatched. */
  pipelineStatus: string | null;
  /** Canonical hash of the last applied callback payload (duplicate detection). */
  pipelineCallbackHash: string | null;
}

const READING_COLS = `id, user_id, type, title, question, category, scope, period_start, period_end,
            price_paid, partner_label, result, reflection, created_at,
            pipeline_status, pipeline_callback_hash`;

export async function saveUniversalReading(
  input: SaveUniversalReadingInput,
): Promise<UniversalReadingRecord> {
  const { rows } = await query(
    `INSERT INTO readings
       (user_id, type, title, question, category, scope, period_start, period_end,
        price_paid, partner_label, result, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
     RETURNING ${READING_COLS}`,
    [
      input.userId,
      input.type,
      input.title ?? null,
      input.question ?? null,
      input.category ?? null,
      input.scope ?? null,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.pricePaid ?? null,
      input.partnerLabel ?? null,
      JSON.stringify(input.result),
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return hydrateRow(rows[0]);
}

export async function listReadingsByType(
  userId: number,
  type: ReadingType,
): Promise<UniversalReadingRecord[]> {
  const { rows } = await query(
    `SELECT ${READING_COLS}
       FROM readings
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC`,
    [userId, type],
  );
  return rows.map(hydrateRow);
}

/** Customer-owned lookup: filters by BOTH id and owner. Never used for staff. */
export async function getReadingById(
  id: number,
  userId: number,
): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `SELECT ${READING_COLS}
       FROM readings
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
}

/** Staff lookup (editor/admin): by id only, no owner filter. Caller must have
 *  already authorized the role. Kept separate so customer lookups stay owned. */
export async function getReportByIdForRole(
  id: number,
): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `SELECT ${READING_COLS}
       FROM readings
      WHERE id = $1 AND type = 'report'`,
    [id],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
}

export async function updateReflection(
  id: number,
  userId: number,
  reflection: string,
): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `UPDATE readings SET reflection = $1
      WHERE id = $2 AND user_id = $3
     RETURNING ${READING_COLS}`,
    [reflection, id, userId],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
}

export interface ProfileStats {
  chartsCount: number;
  tarotCount: number;
  reportCount: number;
  horoscopeCount: number;
}

export async function getProfileStats(userId: number): Promise<ProfileStats> {
  const charts = await query(
    'SELECT COUNT(*)::int AS n FROM natal_charts WHERE user_id = $1',
    [userId],
  );
  const readings = await query(
    `SELECT type, COUNT(*)::int AS n
       FROM readings
      WHERE user_id = $1
      GROUP BY type`,
    [userId],
  );
  const counts: Record<string, number> = {};
  for (const r of readings.rows) counts[r.type] = Number(r.n);
  return {
    chartsCount: charts.rows[0]?.n ?? 0,
    tarotCount: counts.tarot ?? 0,
    reportCount: counts.report ?? 0,
    horoscopeCount: counts.horoscope ?? 0,
  };
}

function hydrateRow(r: any): UniversalReadingRecord {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title ?? null,
    question: r.question ?? null,
    category: r.category ?? null,
    scope: r.scope ?? null,
    periodStart: r.period_start ? String(r.period_start) : null,
    periodEnd: r.period_end ? String(r.period_end) : null,
    pricePaid: r.price_paid != null ? Number(r.price_paid) : null,
    partnerLabel: r.partner_label ?? null,
    result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result ?? {},
    reflection: r.reflection ?? null,
    createdAt: String(r.created_at),
    pipelineStatus: r.pipeline_status ?? null,
    pipelineCallbackHash: r.pipeline_callback_hash ?? null,
  };
}

/**
 * Public sharing (feature: /reports/shared/[token]).
 * A report is shared only through a random uuid, never its sequential integer id,
 * so a shared link is unguessable and other users' readings stay private.
 */

/** Mint (or return existing) share_token for a report the user owns. Idempotent. */
export async function mintShareToken(
  id: number,
  userId: number,
): Promise<string | null> {
  const { rows } = await query(
    `UPDATE readings
        SET share_token = COALESCE(share_token, gen_random_uuid())
      WHERE id = $1 AND user_id = $2
     RETURNING share_token`,
    [id, userId],
  );
  return rows[0]?.share_token ?? null;
}

/** Fetch a reading by its public share_token (no auth). Returns null if absent. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getReadingByShareToken(
  token: string,
): Promise<UniversalReadingRecord | null> {
  // Guard first: anything that isn't a uuid-shaped string can never match the
  // uuid column. Without this, Postgres tries to coerce the literal (e.g. "none")
  // to uuid and throws, which surfaces as a 500 instead of a clean 404.
  if (!token || !UUID_RE.test(token)) return null;
  const { rows } = await query(
    `SELECT ${READING_COLS}
       FROM readings
      WHERE share_token = $1::uuid`,
    [token],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
}

// --- n8n pipeline correlation -------------------------------------------------
// The app issues an app-generated UUID (`reportId`) when dispatching a report to
// n8n and stores it in `result.reportId`. n8n returns that same id on callback,
// so we can locate the owning record without ever trusting a callback-supplied
// user id. Ownership stays on the existing readings row.

/** Find a report reading by its n8n correlation id (app-generated UUID). */
export async function getReadingByReportId(
  reportId: string,
): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `SELECT ${READING_COLS} FROM readings
      WHERE type = 'report' AND result ->> 'reportId' = $1
      ORDER BY created_at DESC LIMIT 1`,
    [reportId],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
}

export type PipelineStatus =
  | 'queued'
  | 'processing'
  | 'approved'
  | 'needs_editor'
  | 'rejected';

/**
 * Persist the dispatch failure so the customer sees a clear state and the record
 * is not left stuck in `queued` after a non-2xx pipeline response.
 */
export async function setReadingDispatchFailed(
  readingId: number,
): Promise<void> {
  await query(
    `UPDATE readings SET pipeline_status = 'rejected' WHERE id = $1`,
    [readingId],
  );
}

/** Canonical hash of a callback payload used for duplicate/conflict detection. */
export function canonicalCallbackHash(payload: {
  status: string;
  sections: unknown[];
  judge: unknown;
  editorNote: string | null;
  rejectReasons: string[];
}): string {
  const canonical = JSON.stringify({
    status: payload.status,
    sections: payload.sections ?? [],
    judge: payload.judge ?? null,
    editorNote: payload.editorNote ?? null,
    rejectReasons: payload.rejectReasons ?? [],
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export type PipelineCallbackOutcome =
  | 'applied'       // state advanced and persisted
  | 'duplicate'     // identical to last applied callback (idempotent no-op)
  | 'conflict'      // same terminal status but different payload (race/bug)
  | 'regression'    // would move a terminal state backwards
  | 'not_found';    // no such report

export interface ApplyPipelineCallbackInput {
  reportId: string;
  status: PipelineStatus;
  /** The inner pipeline object written to result.pipeline. */
  pipelineValue: Record<string, unknown>;
  /** Canonical hash of the incoming callback payload. */
  callbackHash: string;
}

/**
 * Atomically validate and persist a pipeline callback. The SELECT ... FOR UPDATE
 * locks the row so concurrent callbacks cannot both pass the transition check and
 * double-apply. Returns a discriminated outcome the route maps to HTTP codes.
 */
export async function applyPipelineCallback(
  input: ApplyPipelineCallbackInput,
): Promise<PipelineCallbackOutcome> {
  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
      const lock = await tx(
        `SELECT id, pipeline_status, pipeline_callback_hash
           FROM readings
          WHERE type = 'report' AND result ->> 'reportId' = $1
          ORDER BY created_at DESC LIMIT 1
          FOR UPDATE`,
        [input.reportId],
      );
      if (lock.rows.length === 0) return finalize(tx, 'not_found');

      const before = (lock.rows[0].pipeline_status as string) ?? null;
      const prevHash = lock.rows[0].pipeline_callback_hash as string | null;

      // A null prevHash means this status was never persisted (e.g. the row was
      // created in `queued` by dispatch, or a needs_editor gate result is arriving
      // for the first time). Any write of the current status is a valid FIRST
      // WRITE and must be applied; we skip the duplicate/conflict/regression checks
      // because there is no prior payload to compare against. The UPDATE below
      // persists the hash so subsequent identical callbacks become duplicates.
      if (prevHash === null) {
        // fall through to the UPDATE + applied path below
      } else if (before === input.status) {
        // Real no-op transition with a prior payload: dup vs conflict by hash.
        if (prevHash === input.callbackHash) return finalize(tx, 'duplicate');
        return finalize(tx, 'conflict');
      } else if (!canTransitionStore(before, input.status)) {
        // Terminal-state regression is never allowed.
        return finalize(tx, 'regression');
      }

      await tx(
        `UPDATE readings
            SET result = jsonb_set(result, '{pipeline}', $2::jsonb),
                pipeline_status = $3,
                pipeline_callback_hash = $4
          WHERE id = $1`,
        [
          lock.rows[0].id,
          JSON.stringify(input.pipelineValue),
          input.status,
          input.callbackHash,
        ],
      );
      return finalize(tx, 'applied');
    } catch (err) {
      await tx('ROLLBACK');
      throw err;
    }
  });
}

async function finalize(
  tx: (t: string, p?: any[]) => Promise<{ rows: any[] }>,
  outcome: PipelineCallbackOutcome,
): Promise<PipelineCallbackOutcome> {
  if (outcome === 'not_found' || outcome === 'conflict' || outcome === 'regression') {
    await tx('ROLLBACK');
  } else {
    await tx('COMMIT');
  }
  return outcome;
}

// State machine mirror (no import cycle with reportPipeline).
function canTransitionStore(current: string | null, next: string): boolean {
  const terminal = new Set(['approved', 'rejected']);
  if (current === null || current === 'queued' || current === 'processing') return true;
  if (terminal.has(current)) return current === next;
  if (current === 'needs_editor') return next === 'approved' || next === 'rejected';
  return false;
}

// --- Delivery gate (R3) ------------------------------------------------------
// A report is deliverable only after a final `approved` state. Paid reports in
// `needs_editor` (awaiting human sign-off) and `rejected` reports must never be
// shown as a finished reading.

export function isReportDeliverable(rec: UniversalReadingRecord | null): boolean {
  if (!rec || rec.type !== 'report') return false;
  const pipeline = (rec.result?.pipeline as { status?: string } | undefined);
  const status = pipeline?.status ?? rec.pipelineStatus ?? null;
  return status === 'approved';
}

/**
 * Shape returned to the public/shared/owner views. For pipeline reports we expose
 * only the n8n-approved sections when deliverable; otherwise a neutral
 * "being prepared" placeholder. Raw verifiedFacts are NEVER returned.
 */
// Exact public contract for a report section. Stored callback sections carry
// internal fields (factsCited evidence ids, judge internals, callback tokens,
// user ids, arbitrary extra keys). None of those may reach a client, so the
// public shape is constructed field-by-field to exactly {id, prose}.
interface PublicReportSection {
  id: string;
  prose: string;
}

// Build the exact public section array. Drops entries that are not objects,
// have empty/whitespace/missing prose, or are otherwise malformed. Only `id`
// and `prose` are carried over; every other key (factsCited, judge, tokens,
// user ids, arbitrary) is discarded. An absent/empty id falls back to the
// section index so the array stays keyed and stable.
function toPublicSections(sections: unknown): PublicReportSection[] {
  if (!Array.isArray(sections)) return [];
  const out: PublicReportSection[] = [];
  for (const raw of sections) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const prose = typeof s.prose === 'string' ? s.prose : '';
    if (prose.trim().length === 0) continue;
    const id = typeof s.id === 'string' && s.id.trim().length > 0 ? s.id : `section-${out.length}`;
    out.push({ id, prose });
  }
  return out;
}

// Exact public overview row. Only validated string fields are kept.
interface PublicOverviewRow {
  glyph?: string;
  label: string;
  value: string;
  note?: string;
}

// Build the exact public overview array. Drops malformed rows (non-object,
// empty/non-string label, missing/non-string value). Optional glyph/note are
// included only when they are strings; non-string optional fields are omitted
// rather than passed through, so downstream PDF escaping always sees strings.
function toPublicOverview(overview: unknown): PublicOverviewRow[] {
  if (!Array.isArray(overview)) return [];
  const out: PublicOverviewRow[] = [];
  for (const raw of overview) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label : '';
    if (label.trim().length === 0) continue;
    if (typeof r.value !== 'string') continue;
    const row: PublicOverviewRow = { label, value: r.value };
    if (typeof r.glyph === 'string' && r.glyph.length > 0) row.glyph = r.glyph;
    if (typeof r.note === 'string' && r.note.length > 0) row.note = r.note;
    out.push(row);
  }
  return out;
}

export function toPublicReport(rec: UniversalReadingRecord) {
  const pipeline = (rec.result?.pipeline as {
    status?: string; sections?: unknown[]; editorNote?: string | null;
  } | undefined);
  const status = pipeline?.status ?? rec.pipelineStatus ?? null;
  if (isReportDeliverable(rec)) {
    return {
      id: rec.id,
      reportId: (rec.result as any)?.reportId ?? null,
      title: (rec.result as any)?.title ?? rec.title,
      type: (rec.result as any)?.reportType ?? null,
      status,
      overview: toPublicOverview((rec.result as any)?.overview),
      sections: toPublicSections(pipeline?.sections),
      createdAt: rec.createdAt,
    };
  }
  // Non-approved: never surface stored sections/overview, even if they hold
  // prose or secrets. Exact empty arrays.
  return {
    id: rec.id,
    reportId: (rec.result as any)?.reportId ?? null,
    title: (rec.result as any)?.title ?? rec.title,
    type: (rec.result as any)?.reportType ?? null,
    status: status ?? 'queued',
    overview: [],
    sections: [],
    pending: true,
    note: 'Your report is being prepared. We will notify you when it is ready.',
    createdAt: rec.createdAt,
  };
}
