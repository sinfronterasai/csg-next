import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL is not set — database features will be unavailable.');
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Run a sequence of statements atomically on a single connection. `txQuery`
 * executes within the open transaction; callers should BEGIN in `fn` and COMMIT
 * (or ROLLBACK on error) themselves so they can intermix reads (e.g. SELECT ...
 * FOR UPDATE) and writes. The client is always released.
 */
export async function transaction<T>(
  fn: (txQuery: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const txQuery = (text: string, params?: any[]) => client.query(text, params) as Promise<{ rows: any[]; rowCount: number | null }>;
  try {
    return await fn(txQuery);
  } finally {
    client.release();
  }
}
