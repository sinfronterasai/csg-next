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
