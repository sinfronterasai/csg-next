// Regression tests for /profile → /dashboard redirect hotfix.
// These test that the redirect map and middleware no longer route /profile
// to a dead /dashboard, and that /dashboard correctly redirects to /profile.

import { REDIRECT_MAP } from '@/lib/seo/redirect-map';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

// Helper to create a request for middleware testing
function req(path: string, host = 'csg-next.onrender.com') {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe('/profile and /dashboard routing regression', () => {
  test('/profile is NOT in the redirect map anymore (no longer redirects to /dashboard)', () => {
    // Before the fix, REDIRECT_MAP['/profile'] existed and pointed to /dashboard.
    // After the fix, /profile must not be in the map at all — it is the canonical destination.
    expect(REDIRECT_MAP['/profile']).toBeUndefined();
  });

  test('/dashboard 301-redirects to /profile (canonical destination)', () => {
    // /dashboard should redirect to /profile, not the other way around.
    const entry = REDIRECT_MAP['/dashboard'];
    expect(entry).toBeDefined();
    expect(entry?.status).toBe(301);
    expect(entry?.target).toBe('https://cosmicspiritguide.com/profile');
  });

  test('middleware performs the /dashboard → /profile redirect', () => {
    const response = middleware(req('/dashboard'));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://cosmicspiritguide.com/profile');
    // Redirect responses on the preview host should carry the noindex tag.
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  test('/profile passes through middleware without redirect (canonical route)', () => {
    const response = middleware(req('/profile'));
    expect(response.status).toBe(200); // NextResponse.next() → 200
    expect(response.headers.get('location')).toBeNull();
  });

  test('no redirect loop: /profile does not redirect to /dashboard', () => {
    // A simple absence check: the redirect map must not contain /profile → /dashboard.
    const map = REDIRECT_MAP;
    expect(map['/profile']).toBeUndefined();
    // And if /dashboard is requested, it must not redirect back to /profile
    // in a way that creates a loop (it goes to /profile, which is not in the map).
    const dash = middleware(req('/dashboard'));
    expect(dash.status).toBe(301);
    const loc = dash.headers.get('location') || '';
    expect(loc).not.toContain('/dashboard');
  });

  test('/profile redirect target is not /dashboard in any legacy manifest path', () => {
    // Ensure no stray reference maps /profile to /dashboard anywhere we can check.
    for (const [path, entry] of Object.entries(REDIRECT_MAP)) {
      if (path === '/profile') {
        expect(entry).toBeUndefined();
      }
      if (entry.target && entry.target.endsWith('/dashboard')) {
        // If something redirects TO /dashboard, that is fine only if /dashboard
        // itself also redirects to /profile (which we already test above).
        // But we specifically forbid /profile being a source that targets /dashboard.
        expect(path).not.toBe('/profile');
      }
    }
  });
});
