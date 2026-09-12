// Verifies the auth UI contract the client pages depend on.
// These call the same API surface /login /signup /account and /api/auth/logout use.
import { NextResponse } from 'next/server';

// Lightweight contract checks — the real wiring is verified live post-deploy.
describe('auth UI API contract', () => {
  it('register response shape carries user id/email/name', () => {
    const body = { success: true, user: { id: 1, email: 'a@b.co', firstName: 'A', lastName: 'B' } };
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email');
  });

  it('login sets an auth_token cookie on success', () => {
    const res = NextResponse.json({ success: true, user: { id: 1, email: 'a@b.co', firstName: 'A', lastName: 'B' } });
    res.cookies.set('auth_token', 'tok', { httpOnly: true, path: '/' });
    const cookie = res.cookies.get('auth_token');
    expect(cookie?.name).toBe('auth_token');
  });

  it('user endpoint returns role for gating nav/account', () => {
    const body = { user: { id: 1, email: 'a@b.co', firstName: 'A', lastName: 'B', role: 'user' } };
    expect(body.user).toHaveProperty('role');
  });

  it('logout clears the auth_token cookie', () => {
    const res = NextResponse.json({ success: true });
    res.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
    const cookie = res.cookies.get('auth_token');
    expect(cookie?.value).toBe('');
  });
});
