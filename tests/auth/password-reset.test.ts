import { createResetToken, buildPasswordResetUrl, getTrustedClientIp, hashResetToken, normalizeResetEmail } from '@/lib/passwordReset';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { query, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/passwordResetEmail';

jest.mock('@/lib/db', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/auth', () => ({ hashPassword: jest.fn() }));
jest.mock('@/lib/passwordResetEmail', () => ({ sendPasswordResetEmail: jest.fn() }));

type Tx = jest.Mock;

const generic = { message: "If an account exists for that email, we've sent password reset instructions." };

function setupForgot(opts: { user?: any; emailCount?: number; ipCount?: number } = {}) {
  const tx: Tx = jest.fn(async (text: string) => {
    if (text.includes('SELECT count(*)') && text.includes('email_hash')) return { rows: [{ count: opts.emailCount ?? 0 }] };
    if (text.includes('SELECT count(*)') && text.includes('ip_hash')) return { rows: [{ count: opts.ipCount ?? 0 }] };
    if (text.includes('SELECT id, email')) return { rows: opts.user === undefined ? [{ id: 7, email: 'person@example.com' }] : (opts.user ? [opts.user] : []) };
    if (text.includes('RETURNING id')) return { rows: [{ id: 99 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  (transaction as jest.Mock).mockImplementation(async (callback: (txQuery: Tx) => Promise<unknown>) => callback(tx));
  (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
  (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
  process.env.APP_BASE_URL = 'https://cosmicspiritguide.com';
  process.env.RESEND_API_KEY = 'test-only-key';
  return tx;
}

function request(body: unknown, headers: Record<string, string> = { 'cf-connecting-ip': '203.0.113.10' }) {
  return new Request('https://attacker.example/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('password reset security primitives', () => {
  it('creates a 256-bit raw token and persists only its SHA-256 hash', () => {
    const { rawToken, tokenHash } = createResetToken();
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashResetToken(rawToken));
    expect(tokenHash).not.toBe(rawToken);
  });

  it('normalizes and validates reset email input', () => {
    expect(normalizeResetEmail('  PERSON@Example.COM ')).toBe('person@example.com');
    expect(normalizeResetEmail('not-an-email')).toBeNull();
    expect(normalizeResetEmail(null)).toBeNull();
  });

  it('builds reset links from APP_BASE_URL, not request-controlled headers', () => {
    process.env.APP_BASE_URL = 'https://cosmicspiritguide.com';
    const url = buildPasswordResetUrl('raw-token');
    expect(url).toBe('https://cosmicspiritguide.com/reset-password?token=raw-token');
    process.env.APP_BASE_URL = 'https://attacker.example';
    expect(() => buildPasswordResetUrl('raw-token')).toThrow('approved application origin');
  });

  it('uses only the trusted Cloudflare client-IP header', () => {
    expect(getTrustedClientIp(new Request('https://example.com', { headers: { 'cf-connecting-ip': '203.0.113.8', 'x-forwarded-for': '198.51.100.4' } }))).toBe('203.0.113.8');
    expect(getTrustedClientIp(new Request('https://example.com', { headers: { 'x-forwarded-for': '203.0.113.8' } }))).toBeNull();
    expect(getTrustedClientIp(new Request('https://example.com', { headers: { 'cf-connecting-ip': 'not-an-ip' } }))).toBeNull();
  });
});

describe('forgot-password route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_BASE_URL = 'https://cosmicspiritguide.com';
    process.env.RESEND_API_KEY = 'test-only-key';
  });

  it('returns the same generic response for known and unknown emails', async () => {
    setupForgot({ user: { id: 7, email: 'person@example.com' } });
    const known = await forgotPassword(request({ email: ' PERSON@EXAMPLE.COM ' }));
    const knownBody = await known.json();

    setupForgot({ user: null });
    const unknown = await forgotPassword(request({ email: 'unknown@example.com' }));
    const unknownBody = await unknown.json();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(knownBody).toEqual(generic);
    expect(unknownBody).toEqual(generic);
  });

  it('records hashed identifiers and rate-limits email and IP without enumeration', async () => {
    const tx = setupForgot({ emailCount: 3 });
    const response = await forgotPassword(request({ email: 'person@example.com' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(generic);
    expect(tx).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO password_reset_requests'), expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{64}$/)]));
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    jest.clearAllMocks();
    const ipLimited = setupForgot({ ipCount: 10 });
    const ipResponse = await forgotPassword(request({ email: 'different@example.com' }));
    expect(ipResponse.status).toBe(200);
    expect(await ipResponse.json()).toEqual(generic);
    expect(ipLimited).toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('invalidates previous tokens, stores the hash and sends only the raw token in the URL', async () => {
    const tx = setupForgot({ user: { id: 7, email: 'person@example.com' } });
    await forgotPassword(request({ email: 'person@example.com' }));
    const insert = tx.mock.calls.find(([text]) => text.includes('INSERT INTO password_reset_tokens'));
    const emailCall = (sendPasswordResetEmail as jest.Mock).mock.calls[0];
    expect(insert).toBeDefined();
    expect(emailCall[0]).toBe('person@example.com');
    expect(emailCall[1]).toMatch(/^https:\/\/cosmicspiritguide\.com\/reset-password\?token=[0-9a-f]{64}$/);
    expect(JSON.stringify(insert[1])).not.toContain(new URL(emailCall[1]).searchParams.get('token'));
    expect(insert[1][1]).toMatch(/^[0-9a-f]{64}$/);
    expect(insert[1][2]).toBe(30 * 60 * 1000);
    expect(tx).toHaveBeenCalledWith(expect.stringContaining('SET revoked_at = now()'), [7]);
    expect(emailCall[2]).toBe('password-reset/99');
  });

  it('fails safely when APP_BASE_URL is unavailable without creating reset state', async () => {
    setupForgot({ user: { id: 7, email: 'person@example.com' } });
    delete process.env.APP_BASE_URL;
    const response = await forgotPassword(request({ email: 'person@example.com' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(generic);
    expect(transaction).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('revokes the token when Resend fails without exposing provider details', async () => {
    const tx = setupForgot({ user: { id: 7, email: 'person@example.com' } });
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue(new Error('secret provider payload'));
    const response = await forgotPassword(request({ email: 'person@example.com' }));
    const responseBody = await response.json();
    expect(response.status).toBe(200);
    expect(responseBody).toEqual(generic);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE password_reset_tokens SET revoked_at'), [99]);
    expect(JSON.stringify(responseBody)).not.toContain('secret provider payload');
    expect(tx).toHaveBeenCalled();
  });
});

describe('reset-password route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hashPassword as jest.Mock).mockResolvedValue('bcrypt-hash');
  });

  it('rejects short passwords before touching the database', async () => {
    const response = await resetPassword(new Request('https://cosmicspiritguide.com/api/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token: 'a'.repeat(64), newPassword: 'short' }),
    }));
    expect(response.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('atomically updates the password, consumes the token and revokes remaining tokens', async () => {
    const tx: Tx = jest.fn(async (text: string) => {
      if (text.includes('FROM password_reset_tokens')) return { rows: [{ id: 99, user_id: 7 }], rowCount: 1 };
      if (text.includes('UPDATE users')) return { rows: [{ id: 7 }], rowCount: 1 };
      if (text.includes('SET consumed_at')) return { rows: [{ id: 99 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    (transaction as jest.Mock).mockImplementation(async (callback: (txQuery: Tx) => Promise<unknown>) => callback(tx));

    const response = await resetPassword(new Request('https://cosmicspiritguide.com/api/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token: 'raw-token', newPassword: 'new-password' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(hashPassword).toHaveBeenCalledWith('new-password');
    expect(tx).toHaveBeenCalledWith(expect.stringContaining('UPDATE users SET password_hash'), ['bcrypt-hash', 7]);
    expect(JSON.stringify(tx.mock.calls)).not.toContain('new-password');
    expect(tx).toHaveBeenCalledWith(expect.stringContaining('SET consumed_at = now()'), expect.any(Array));
    expect(tx).toHaveBeenCalledWith(expect.stringContaining('SET revoked_at = now()'), [7, 99]);
  });

  it('rejects invalid, expired, consumed, revoked and reused tokens without password changes', async () => {
    const tx: Tx = jest.fn(async (text: string) => text.includes('FROM password_reset_tokens') ? { rows: [], rowCount: 0 } : { rows: [], rowCount: 1 });
    (transaction as jest.Mock).mockImplementation(async (callback: (txQuery: Tx) => Promise<unknown>) => callback(tx));
    const response = await resetPassword(new Request('https://cosmicspiritguide.com/api/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token: 'invalid', newPassword: 'new-password' }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('invalid or has expired');
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('prevents a second concurrent consumption after the token row is no longer eligible', async () => {
    const tx: Tx = jest.fn(async (text: string) => text.includes('FROM password_reset_tokens') ? { rows: [], rowCount: 0 } : { rows: [], rowCount: 1 });
    (transaction as jest.Mock).mockImplementation(async (callback: (txQuery: Tx) => Promise<unknown>) => callback(tx));
    const response = await resetPassword(new Request('https://cosmicspiritguide.com/api/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token: 'raw-token', newPassword: 'new-password' }),
    }));
    expect(response.status).toBe(400);
    expect(hashPassword).not.toHaveBeenCalled();
  });
});
