import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(__dirname, '../../src/lib/profile/migration.sql'), 'utf8');
const passwordResetMigration = migration.slice(migration.indexOf('-- Password reset tokens and bounded forgot-password abuse controls.'));

async function applyPasswordResetMigration(db: PGlite) {
  await db.exec(passwordResetMigration);
}

async function columnNames(db: PGlite, tableName: string) {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [tableName],
  );
  return result.rows.map((row) => row.column_name);
}

describe('password-reset schema reconciliation', () => {
  it('creates the clean M11A schema and remains idempotent', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        SET TIME ZONE 'UTC';
        CREATE FUNCTION digest(data text, algorithm text) RETURNS bytea
        LANGUAGE SQL IMMUTABLE AS $$ SELECT decode(md5(data) || md5(data), 'hex') $$;
        CREATE TABLE users (id integer PRIMARY KEY, email text NOT NULL);
        INSERT INTO users VALUES (1, 'clean-fixture@example.test');
      `);
      await applyPasswordResetMigration(db);
      await applyPasswordResetMigration(db);

      expect(await columnNames(db, 'password_reset_tokens')).toEqual([
        'id', 'user_id', 'token_hash', 'created_at', 'expires_at', 'consumed_at', 'revoked_at',
      ]);
      expect(await columnNames(db, 'password_reset_requests')).toEqual([
        'id', 'email_hash', 'ip_hash', 'requested_at',
      ]);
      expect((await db.query<{ count: string }>(`SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
        'idx_password_reset_tokens_user_active',
        'idx_password_reset_requests_email_window',
        'idx_password_reset_requests_ip_window'
      )`)).rows[0].count).toBe(3);

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (1, repeat('a', 64), now() + interval '30 minutes')`,
      );
      await db.query(
        `INSERT INTO password_reset_requests (email_hash, ip_hash) VALUES (repeat('b', 64), repeat('c', 64))`,
      );
      expect((await db.query('SELECT count(*) FROM password_reset_tokens')).rows[0].count).toBe(1);
      expect((await db.query('SELECT count(*) FROM password_reset_requests')).rows[0].count).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('preserves legacy rows while hashing and invalidating raw legacy tokens', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        SET TIME ZONE 'UTC';
        CREATE FUNCTION digest(data text, algorithm text) RETURNS bytea
        LANGUAGE SQL IMMUTABLE AS $$ SELECT decode(md5(data) || md5(data), 'hex') $$;
        CREATE TABLE users (id integer PRIMARY KEY, email text NOT NULL);
        INSERT INTO users VALUES (7, 'fixture@example.test');
        CREATE TABLE password_reset_tokens (
          id serial PRIMARY KEY,
          user_id integer REFERENCES users(id) ON DELETE CASCADE,
          token varchar(255) NOT NULL UNIQUE,
          expires_at timestamp NOT NULL,
          used boolean DEFAULT false,
          created_at timestamp DEFAULT now()
        );
        INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at)
        VALUES (7, 'legacy-fixture-token-1', now() - interval '2 days', true, now() - interval '2 days'),
               (7, 'legacy-fixture-token-2', now() - interval '1 day', false, now() - interval '1 day');
      `);

      await applyPasswordResetMigration(db);
      await applyPasswordResetMigration(db);

      expect(await columnNames(db, 'password_reset_tokens')).toEqual([
        'id', 'user_id', 'expires_at', 'created_at', 'token_hash', 'consumed_at', 'revoked_at',
      ]);
      const rows = await db.query<{ count: string; null_hash: string; active: string; consumed: string; revoked: string; hash_length: number }>(
        `SELECT count(*) AS count,
                count(*) FILTER (WHERE token_hash IS NULL) AS null_hash,
                count(*) FILTER (WHERE consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()) AS active,
                count(*) FILTER (WHERE consumed_at IS NOT NULL) AS consumed,
                count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked,
                min(length(token_hash)) AS hash_length
           FROM password_reset_tokens`,
      );
      expect(rows.rows[0]).toMatchObject({ count: 2, null_hash: 0, active: 0, consumed: 1, revoked: 1, hash_length: 64 });
      expect((await db.query(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'password_reset_tokens' AND column_name IN ('token', 'used')`)).rows[0].count).toBe(0);
      expect((await db.query('SELECT count(*) FROM password_reset_requests')).rows[0].count).toBe(0);

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (7, repeat('d', 64), now() + interval '30 minutes')`,
      );
      await db.query(`UPDATE password_reset_tokens SET consumed_at = now() WHERE token_hash = repeat('d', 64)`);
      expect((await db.query(`SELECT count(*) FROM password_reset_tokens WHERE token_hash = repeat('d', 64) AND consumed_at IS NOT NULL`)).rows[0].count).toBe(1);
    } finally {
      await db.close();
    }
  });
});
