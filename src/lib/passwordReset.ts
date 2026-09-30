import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_GENERIC_MESSAGE = "If an account exists for that email, we've sent password reset instructions.";
export const PASSWORD_RESET_FROM = 'Cosmic Spirit Guide <noreply@cosmicspiritguide.com>';
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_IP_LIMIT = 10;

export function normalizeResetEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function createResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}

export function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function hashRateLimitIdentifier(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function getConfiguredAppBaseUrl(): URL {
  const configured = process.env.APP_BASE_URL;
  if (!configured) throw new Error('APP_BASE_URL is required for password reset links');
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('APP_BASE_URL is invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('APP_BASE_URL must be an HTTPS origin');
  }
  return parsed;
}

export function buildPasswordResetUrl(rawToken: string): string {
  const url = new URL('/reset-password', getConfiguredAppBaseUrl());
  url.searchParams.set('token', rawToken);
  return url.toString();
}

/**
 * Render's managed HTTPS proxy supplies X-Forwarded-For. We accept only the
 * first syntactically valid address from that proxy header, then fall back to
 * X-Real-IP. If neither is available, the IP limiter is skipped rather than
 * trusting an arbitrary request-controlled host or inventing an identifier.
 */
export function getTrustedClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim() ?? '';
    if (isIP(first)) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim() ?? '';
  return isIP(realIp) ? realIp : null;
}

export function isValidResetPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}
