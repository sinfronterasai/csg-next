import { query } from '@/lib/db';

export interface SaveReadingInput {
  userId: number;
  spreadId: string;
  question: string;
  category?: string;
  positions: { label: string; meaning: string }[];
  cards: { name: string; reversed: boolean; image?: string }[];
  interpretation: string;
  astrology?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}

export interface ReadingRecord {
  id: number;
  userId: number;
  spreadId: string | null;
  question: string;
  category: string | null;
  positions: { label: string; meaning: string }[];
  cards: { name: string; reversed: boolean; image?: string }[];
  interpretation: string;
  astrology: Record<string, unknown> | null;
  reflection: string | null;
  createdAt: string;
}

const READING_TYPE = 'tarot';

export async function saveReading(input: SaveReadingInput): Promise<ReadingRecord> {
  const { rows } = await query(
    `INSERT INTO readings
       (user_id, type, spread_id, question, category, reading_type,
        result, meta, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     RETURNING id, user_id, spread_id, question, category, created_at`,
    [
      input.userId,
      READING_TYPE,
      input.spreadId,
      input.question,
      input.category ?? null,
      input.spreadId, // reading_type doubles as the spread key for tarot
      JSON.stringify({
        positions: input.positions,
        cards: input.cards,
        interpretation: input.interpretation,
        astrology: input.astrology ?? null,
      }),
      JSON.stringify(input.meta ?? {}),
    ],
  );
  const row = rows[0];
  return hydrate(row, input);
}

export async function listReadings(userId: number): Promise<ReadingRecord[]> {
  const { rows } = await query(
    `SELECT id, user_id, spread_id, question, category, created_at, result, reflection
       FROM readings
      WHERE user_id = $1 AND type = $2
      ORDER BY created_at DESC`,
    [userId, READING_TYPE],
  );
  return rows.map((r) => hydrateRow(r));
}

export async function getReading(id: number, userId: number): Promise<ReadingRecord | null> {
  const { rows } = await query(
    `SELECT id, user_id, spread_id, question, category, created_at, result, reflection
       FROM readings
      WHERE id = $1 AND user_id = $2 AND type = $3`,
    [id, userId, READING_TYPE],
  );
  if (!rows[0]) return null;
  return hydrateRow(rows[0]);
}

export async function updateReflection(id: number, userId: number, reflection: string): Promise<ReadingRecord | null> {
  const { rows } = await query(
    `UPDATE readings SET reflection = $1
       WHERE id = $2 AND user_id = $3 AND type = $4
     RETURNING id, user_id, spread_id, question, category, created_at, result, reflection`,
    [reflection, id, userId, READING_TYPE],
  );
  if (!rows[0]) return null;
  return hydrateRow(rows[0]);
}

export async function deleteReading(id: number): Promise<void> {
  await query(`DELETE FROM readings WHERE id = $1 AND type = $2`, [id, READING_TYPE]);
}

function hydrateRow(r: any): ReadingRecord {
  const result = r.result ?? {};
  return {
    id: r.id,
    userId: r.user_id,
    spreadId: r.spread_id,
    question: r.question,
    category: r.category,
    positions: result.positions ?? [],
    cards: result.cards ?? [],
    interpretation: result.interpretation ?? '',
    astrology: result.astrology ?? null,
    reflection: r.reflection ?? null,
    createdAt: String(r.created_at),
  };
}

function hydrate(row: any, input: SaveReadingInput): ReadingRecord {
  return {
    id: row.id,
    userId: row.user_id,
    spreadId: row.spread_id,
    question: row.question,
    category: row.category,
    positions: input.positions,
    cards: input.cards,
    interpretation: input.interpretation,
    astrology: input.astrology ?? null,
    reflection: null,
    createdAt: String(row.created_at),
  };
}
