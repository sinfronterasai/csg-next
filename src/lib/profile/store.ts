import { query } from '@/lib/db';

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
}

export async function saveUniversalReading(
  input: SaveUniversalReadingInput,
): Promise<UniversalReadingRecord> {
  const { rows } = await query(
    `INSERT INTO readings
       (user_id, type, title, question, category, scope, period_start, period_end,
        price_paid, partner_label, result, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
     RETURNING id, user_id, type, title, question, category, scope,
               period_start, period_end, price_paid, partner_label,
               result, reflection, created_at`,
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
    `SELECT id, user_id, type, title, question, category, scope, period_start, period_end,
            price_paid, partner_label, result, reflection, created_at
       FROM readings
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC`,
    [userId, type],
  );
  return rows.map(hydrateRow);
}

export async function getReadingById(
  id: number,
  userId: number,
): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `SELECT id, user_id, type, title, question, category, scope, period_start, period_end,
            price_paid, partner_label, result, reflection, created_at
       FROM readings
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
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
     RETURNING id, user_id, type, title, question, category, scope, period_start, period_end,
               price_paid, partner_label, result, reflection, created_at`,
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
    `SELECT id, user_id, type, title, question, category, scope, period_start, period_end,
            price_paid, partner_label, result, reflection, created_at
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

const READING_COLS = `id, user_id, type, title, question, category, scope, period_start, period_end,
            price_paid, partner_label, result, reflection, created_at`;

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
 * Idempotently apply a pipeline outcome to the record identified by reportId.
 * Returns the updated row, or null if no such report exists. The caller must
 * enforce state-machine rules (no terminal regression, no conflicting duplicate)
 * BEFORE calling this; this function only performs the write.
 */
export async function applyPipelineResult(input: {
  reportId: string;
  status: PipelineStatus;
  resultPatch: Record<string, unknown>;
  pipelineStatus?: PipelineStatus;
}): Promise<UniversalReadingRecord | null> {
  const { rows } = await query(
    `UPDATE readings
        SET result = jsonb_set(result, '{pipeline}', $2::jsonb),
            pipeline_status = $3
      WHERE id = (
        SELECT id FROM readings
         WHERE type = 'report' AND result ->> 'reportId' = $1
         ORDER BY created_at DESC LIMIT 1
      )
     RETURNING ${READING_COLS}`,
    [
      input.reportId,
      JSON.stringify(input.resultPatch),
      input.pipelineStatus ?? input.status,
    ],
  );
  return rows[0] ? hydrateRow(rows[0]) : null;
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
      overview: (rec.result as any)?.overview ?? [],
      sections: pipeline?.sections ?? [],
      createdAt: rec.createdAt,
    };
  }
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
