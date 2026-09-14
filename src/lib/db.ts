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
  idleTimeoutMillis: 1_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// PostgreSQL can terminate an idle pooled connection during a long-running
// deterministic report build or a transient network event. `pg` emits that
// failure from the pool; without a listener Node treats it as an uncaught
// exception and the whole Render instance exits. The failed client is removed
// by `pg`, so the next query can obtain a fresh connection.
pool.on('error', (error) => {
  console.error('[db] pooled connection error; discarded by pg', error);
});

async function connectHealthy() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let client: any;
    try {
      client = await pool.connect();
      client.on('error', (error: unknown) => {
        console.error('[db] client connection error; client will be discarded', error);
      });
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      lastError = error;
      // The health check runs before the caller's real query or transaction,
      // so destroying and retrying this client cannot replay a write.
      client?.release(true);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Database connection unavailable');
}

export async function query(text: string, params?: any[]) {
  const client = await connectHealthy();
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
  const client = await connectHealthy();
  const txQuery = (text: string, params?: any[]) => client.query(text, params) as Promise<{ rows: any[]; rowCount: number | null }>;
  try {
    return await fn(txQuery);
  } finally {
    client.release();
  }
}
