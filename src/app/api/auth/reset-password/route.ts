import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { hashResetToken, isValidResetPassword } from '@/lib/passwordReset';

const INVALID_TOKEN_MESSAGE = 'This password reset link is invalid or has expired.';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body as { token?: unknown } | null)?.token;
  const newPassword = (body as { newPassword?: unknown } | null)?.newPassword;
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }
  if (!isValidResetPassword(newPassword)) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);
  try {
    const reset = await transaction(async (tx) => {
      await tx('BEGIN');
      try {
        const tokenResult = await tx(
          `SELECT id, user_id
             FROM password_reset_tokens
            WHERE token_hash = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > now()
            FOR UPDATE`,
          [tokenHash],
        );
        const row = tokenResult.rows[0];
        if (!row) {
          await tx('ROLLBACK');
          return false;
        }

        const newHash = await hashPassword(newPassword);
        const userResult = await tx(
          'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
          [newHash, row.user_id],
        );
        if (userResult.rowCount !== 1) {
          await tx('ROLLBACK');
          return false;
        }

        const consumed = await tx(
          `UPDATE password_reset_tokens
              SET consumed_at = now()
            WHERE id = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > now()
            RETURNING id`,
          [row.id],
        );
        if (consumed.rowCount !== 1) {
          await tx('ROLLBACK');
          return false;
        }

        await tx(
          `UPDATE password_reset_tokens
              SET revoked_at = now()
            WHERE user_id = $1
              AND id <> $2
              AND consumed_at IS NULL
              AND revoked_at IS NULL`,
          [row.user_id, row.id],
        );
        await tx('COMMIT');
        return true;
      } catch (error) {
        await tx('ROLLBACK');
        throw error;
      }
    });

    if (!reset) return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    console.error('[auth/reset-password] reset failed');
    return NextResponse.json({ error: 'Unable to reset password right now' }, { status: 500 });
  }
}
