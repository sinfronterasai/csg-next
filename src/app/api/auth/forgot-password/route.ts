import { NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/passwordResetEmail';
import {
  buildPasswordResetUrl,
  createResetToken,
  getConfiguredAppBaseUrl,
  getTrustedClientIp,
  hashRateLimitIdentifier,
  normalizeResetEmail,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_TTL_MS,
} from '@/lib/passwordReset';

function genericResponse() {
  return NextResponse.json({ message: PASSWORD_RESET_GENERIC_MESSAGE }, { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = normalizeResetEmail((body as { email?: unknown } | null)?.email);
  if (!email) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });

  try {
    // Validate the trusted origin before creating any reset state. The request
    // Host/Origin/Referer headers are intentionally never consulted.
    getConfiguredAppBaseUrl();
  } catch {
    console.error('[auth/forgot-password] reset origin is unavailable');
    return genericResponse();
  }

  const clientIp = getTrustedClientIp(request);
  const emailHash = hashRateLimitIdentifier(email);
  const ipHash = clientIp ? hashRateLimitIdentifier(clientIp) : null;
  let issued: { tokenId: number; rawToken: string; email: string } | null = null;

  try {
    issued = await transaction(async (tx) => {
      await tx('BEGIN');
      try {
        await tx("DELETE FROM password_reset_requests WHERE requested_at < now() - interval '24 hours'");

        // Serialize requests for the same identifiers so concurrent requests
        // cannot pass the rolling-window checks together.
        const lockKeys = [
          { key: `password-reset-email:${emailHash}`, order: emailHash },
          ...(ipHash ? [{ key: `password-reset-ip:${ipHash}`, order: ipHash }] : []),
        ].sort((a, b) => a.order.localeCompare(b.order));
        for (const lock of lockKeys) {
          await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lock.key]);
        }

        const emailCount = await tx(
          "SELECT count(*)::int AS count FROM password_reset_requests WHERE email_hash = $1 AND requested_at > now() - interval '1 hour'",
          [emailHash],
        );
        const ipCount = ipHash
          ? await tx(
              "SELECT count(*)::int AS count FROM password_reset_requests WHERE ip_hash = $1 AND requested_at > now() - interval '1 hour'",
              [ipHash],
            )
          : { rows: [{ count: 0 }] };
        const limited = Number(emailCount.rows[0]?.count ?? 0) >= PASSWORD_RESET_EMAIL_LIMIT
          || Number(ipCount.rows[0]?.count ?? 0) >= PASSWORD_RESET_IP_LIMIT;

        await tx(
          'INSERT INTO password_reset_requests (email_hash, ip_hash) VALUES ($1, $2)',
          [emailHash, ipHash],
        );

        if (limited) {
          await tx('COMMIT');
          return null;
        }

        const userResult = await tx(
          `SELECT id, email
             FROM users
            WHERE LOWER(email) = $1`,
          [email],
        );
        const user = userResult.rows[0];
        if (!user) {
          await tx('COMMIT');
          return null;
        }

        await tx(
          'UPDATE password_reset_tokens SET revoked_at = now() WHERE user_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL',
          [user.id],
        );
        const { rawToken, tokenHash } = createResetToken();
        const token = await tx(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, now() + ($3 * interval '1 millisecond'))
           RETURNING id`,
          [user.id, tokenHash, PASSWORD_RESET_TTL_MS],
        );
        await tx('COMMIT');
        return { tokenId: Number(token.rows[0].id), rawToken, email: user.email };
      } catch (error) {
        await tx('ROLLBACK');
        throw error;
      }
    });
  } catch {
    console.error('[auth/forgot-password] reset request persistence failed');
    return genericResponse();
  }

  if (issued) {
    try {
      await sendPasswordResetEmail(issued.email, buildPasswordResetUrl(issued.rawToken), `password-reset/${issued.tokenId}`);
    } catch {
      // Do not leave a token usable after a known provider failure. The public
      // response remains generic and never exposes provider/account state.
      try {
        await query('UPDATE password_reset_tokens SET revoked_at = now() WHERE id = $1 AND consumed_at IS NULL', [issued.tokenId]);
      } catch {
        console.error('[auth/forgot-password] failed to revoke undelivered reset token');
      }
      console.error('[auth/forgot-password] email delivery failed');
    }
  }

  return genericResponse();
}
