// Regression tests for /profile /dashboard routing and SEO disposition.
// These test that the redirect map and middleware no longer route /profile
// to a dead /dashboard, that /dashboard correctly redirects to /profile,
// and that /profile is a non-indexable NOINDEX_UTILITY account utility.

import { REDIRECT_MAP } from '@/lib/seo/redirect-map';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { loadManifest } from '@/lib/seo/redirects';

// Helper to create a request for middleware testing
function req(path: string, host = 'csg-next.onrender.com') {
  return new NextRequest(`https://${host}${path}`, { headers: { host } });
}

describe('/profile and /dashboard routing regression', () => {
  test('/profile is NOT in the redirect map (no longer redirects to /dashboard)', () => {
    expect(REDIRECT_MAP['/profile']).toBeUndefined();
  });

  test('/dashboard 301-redirects to /profile (canonical destination)', () => {
    const entry = REDIRECT_MAP['/dashboard'];
    expect(entry).toBeDefined();
    expect(entry?.status).toBe(301);
    expect(entry?.target).toBe('https://cosmicspiritguide.com/profile');
  });

  test('middleware performs the /dashboard → /profile redirect', () => {
    const response = middleware(req('/dashboard'));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://cosmicspiritguide.com/profile');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  test('/profile passes through middleware without redirect (canonical route)', () => {
    const response = middleware(req('/profile'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  test('no redirect loop: /profile does not redirect to /dashboard', () => {
    expect(REDIRECT_MAP['/profile']).toBeUndefined();
    const dash = middleware(req('/dashboard'));
    expect(dash.status).toBe(301);
    const loc = dash.headers.get('location') || '';
    expect(loc).not.toContain('/dashboard');
  });

  test('/profile is not a redirect source targeting /dashboard anywhere in the map', () => {
    for (const [path, entry] of Object.entries(REDIRECT_MAP)) {
      if (path === '/profile') {
        expect(entry).toBeUndefined();
      }
      if (entry.target && entry.target.endsWith('/dashboard')) {
        expect(path).not.toBe('/profile');
      }
    }
  });

  test('/profile is non-indexable NOINDEX_UTILITY in the manifest', () => {
    const rows = loadManifest();
    const profileRow = rows.find((r: { oldPath: string }) => r.oldPath === '/profile');
    expect(profileRow).toBeDefined();
    expect(profileRow!.disposition).toBe('NOINDEX_UTILITY');
    expect(profileRow!.indexable).toBe(false);
    expect(profileRow!.redirectTarget).toBeNull();
    expect(profileRow!.canonicalUrl).toBe('https://cosmicspiritguide.com/profile');
  });
});
