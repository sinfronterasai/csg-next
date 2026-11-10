import { cookies } from 'next/headers';
import { getUserById, verifyToken, hashPassword, verifyPassword } from '@/lib/auth';
import { query, transaction } from '@/lib/db';

export async function currentAdminUser() {
  const token = (await cookies()).get('auth_token')?.value;
  const decoded = token ? verifyToken(token) : null;
  return decoded ? getUserById(decoded.userId) : null;
}

export async function userAnalytics(search: string, page: number) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const where = `($1 = '%%' OR email ILIKE $1 OR concat_ws(' ', first_name, last_name) ILIKE $1)`;
  const [summary, daily, users, filtered] = await Promise.all([
    query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::int AS today,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS month FROM users`),
    query(`SELECT to_char(d.day, 'YYYY-MM-DD') AS day, count(u.id)::int AS count
      FROM generate_series((now() AT TIME ZONE 'UTC')::date - 29, (now() AT TIME ZONE 'UTC')::date, interval '1 day') d(day)
      LEFT JOIN users u ON u.created_at >= d.day AT TIME ZONE 'UTC' AND u.created_at < (d.day + interval '1 day') AT TIME ZONE 'UTC'
      GROUP BY d.day ORDER BY d.day`),
    query(`SELECT id, email, first_name, last_name, role, created_at FROM users WHERE ${where}
      ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 25 OFFSET $2`, [pattern, (page - 1) * 25]),
    query(`SELECT count(*)::int AS total FROM users WHERE ${where}`, [pattern]),
  ]);
  return { summary: summary.rows[0], daily: daily.rows, users: users.rows, total: filtered.rows[0].total, page, pageSize: 25 };
}

export class AdminUserError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Created only after an authorized admin invokes a password change. Idempotent
// so existing deployments do not require a separate manual migration step.
async function ensureAuditTable() {
  await query(`CREATE TABLE IF NOT EXISTS admin_user_password_audit (
    id bigserial PRIMARY KEY, actor_id text NOT NULL, target_id text NOT NULL,
    reason text NOT NULL, outcome text NOT NULL CHECK (outcome IN ('attempt', 'success')),
    created_at timestamptz NOT NULL DEFAULT now())`);
  await query(`CREATE INDEX IF NOT EXISTS admin_user_password_audit_actor_time
    ON admin_user_password_audit(actor_id, created_at)`);
}

export async function changeUserPassword(actorId: string, targetId: string, currentPassword: string, newPassword: string, reason: string) {
  await ensureAuditTable();
  // Persist attempts before password verification, serializing concurrent calls
  // to enforce a rolling rate limit across processes and service restarts.
  await transaction(async (tx) => {
    await tx('BEGIN');
    try {
      await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`admin-password:${actorId}`]);
      const attempts = await tx(`SELECT count(*)::int AS count FROM admin_user_password_audit
        WHERE actor_id = $1 AND outcome = 'attempt' AND created_at > now() - interval '15 minutes'`, [actorId]);
      if (Number(attempts.rows[0]?.count) >= 10) throw new AdminUserError('Too many attempts. Try again in 15 minutes.', 429);
      await tx(`INSERT INTO admin_user_password_audit (actor_id, target_id, reason, outcome) VALUES ($1, $2, $3, 'attempt')`, [actorId, targetId, reason]);
      await tx('COMMIT');
    } catch (error) { await tx('ROLLBACK'); throw error; }
  });

  const actor = await query('SELECT password_hash, role FROM users WHERE id = $1', [actorId]);
  if (actor.rows[0]?.role !== 'admin' || !actor.rows[0]?.password_hash || !await verifyPassword(currentPassword, actor.rows[0].password_hash)) {
    throw new AdminUserError('Your current administrator password is incorrect.', 403);
  }
  const hash = await hashPassword(newPassword);
  await transaction(async (tx) => {
    await tx('BEGIN');
    try {
      // Recheck role and credentials under a lock before committing the change.
      const lockedActor = await tx('SELECT role, password_hash FROM users WHERE id = $1 FOR UPDATE', [actorId]);
      if (lockedActor.rows[0]?.role !== 'admin' || lockedActor.rows[0]?.password_hash !== actor.rows[0].password_hash) {
        throw new AdminUserError('Administrator credentials changed. Sign in again.', 403);
      }
      const target = await tx('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [targetId]);
      if (!target.rows[0]) throw new AdminUserError('User not found.', 404);
      if (String(actorId) === String(targetId) || ['admin', 'editor'].includes(target.rows[0].role)) {
        throw new AdminUserError('Staff accounts must use their own password reset flow.', 403);
      }
      await tx('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, targetId]);
      await tx(`UPDATE password_reset_tokens SET revoked_at = now()
        WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`, [targetId]);
      await tx(`INSERT INTO admin_user_password_audit (actor_id, target_id, reason, outcome) VALUES ($1, $2, $3, 'success')`, [actorId, targetId, reason]);
      await tx('COMMIT');
    } catch (error) { await tx('ROLLBACK'); throw error; }
  });
}
