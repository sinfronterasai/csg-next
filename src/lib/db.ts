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
