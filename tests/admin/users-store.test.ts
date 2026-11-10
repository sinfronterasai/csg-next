import { PGlite } from '@electric-sql/pglite';
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/db', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn(), getUserById: jest.fn(), hashPassword: jest.fn(), verifyPassword: jest.fn() }));
import { query, transaction } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { userAnalytics, changeUserPassword } from '@/lib/admin/users';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE TABLE users (id serial PRIMARY KEY, email text, first_name text, last_name text, role text, created_at timestamptz DEFAULT now(), password_hash text);
    CREATE TABLE password_reset_tokens (id serial PRIMARY KEY, user_id int, consumed_at timestamptz, revoked_at timestamptz);`);
  (query as jest.Mock).mockImplementation(async (sql: string, values?: unknown[]) => {
    const result = await db.query(sql, values); return { ...result, rowCount: result.affectedRows };
  });
  (transaction as jest.Mock).mockImplementation(async (fn: any) => fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
    const result = await db.query(sql, values); return { ...result, rowCount: result.affectedRows };
  }));
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE users, password_reset_tokens RESTART IDENTITY;
    INSERT INTO users(email, first_name, role, password_hash, created_at) VALUES
    ('admin@example.com', 'Admin', 'admin', 'admin-hash', now() - interval '90 days'),
    ('customer@example.com', 'Alice', 'user', 'old-hash', now()),
    ('old@example.com', 'Old', 'user', 'old-hash', now() - interval '45 days');
    INSERT INTO password_reset_tokens(user_id) VALUES (2);`);
  await db.exec('DROP TABLE IF EXISTS admin_user_password_audit');
  (verifyPassword as jest.Mock).mockResolvedValue(true); (hashPassword as jest.Mock).mockResolvedValue('new-hash');
});
it('counts signups in UTC, zero-fills the trend and searches without leaking hashes', async () => {
  const data = await userAnalytics('Alice', 1);
  expect(data.summary).toEqual({ total: 3, today: 1, week: 1, month: 1 });
  expect(data.daily).toHaveLength(30); expect(data.daily.reduce((n, d) => n + d.count, 0)).toBe(1);
  expect(data.total).toBe(1); expect(data.users[0].email).toBe('customer@example.com');
  expect(JSON.stringify(data)).not.toContain('hash');
  expect((await userAnalytics('%', 1)).total).toBe(0);
});
it('changes credentials atomically, revokes unused links and records an audit without passwords', async () => {
  await changeUserPassword('1', '2', 'admin-secret', 'customer-secret', 'Support request');
  expect((await db.query('SELECT password_hash FROM users WHERE id=2')).rows).toEqual([{ password_hash: 'new-hash' }]);
  expect((await db.query('SELECT revoked_at FROM password_reset_tokens')).rows[0].revoked_at).not.toBeNull();
  const audit = await db.query('SELECT * FROM admin_user_password_audit ORDER BY id');
  expect(audit.rows.map((row: any) => row.outcome)).toEqual(['attempt', 'success']);
  expect(JSON.stringify(audit.rows)).not.toMatch(/secret|hash/);
});
it('does not change a user when admin reauthentication fails', async () => {
  (verifyPassword as jest.Mock).mockResolvedValue(false);
  await expect(changeUserPassword('1', '2', 'wrong', 'new-password', 'Support request')).rejects.toThrow('incorrect');
  expect((await db.query('SELECT password_hash FROM users WHERE id=2')).rows[0].password_hash).toBe('old-hash');
});
it('blocks staff-account changes and rolls back the password write', async () => {
  await expect(changeUserPassword('1', '1', 'admin-secret', 'new-password', 'Support request')).rejects.toThrow('Staff accounts');
  expect((await db.query('SELECT password_hash FROM users WHERE id=1')).rows[0].password_hash).toBe('admin-hash');
});
it('limits repeated attempts across requests', async () => {
  (verifyPassword as jest.Mock).mockResolvedValue(false);
  for (let i = 0; i < 10; i++) await expect(changeUserPassword('1', '2', 'wrong', 'new-password', 'Support request')).rejects.toThrow('incorrect');
  await expect(changeUserPassword('1', '2', 'wrong', 'new-password', 'Support request')).rejects.toThrow('Too many attempts');
});
