// PIKE — LB-PUBLIC regression tests.
// These tests prove the Love Blueprint beta allowlist gate is removed and
// the CTA starts checkout (not generation) for ordinary authenticated users.
//
// RED phase: these tests FAIL against origin/main, proving the bug exists.
// GREEN phase: after the fix, all tests pass.

import { gateCheckout, gateGeneration, isLaunchType, LAUNCH_FREE_TYPES, LAUNCH_PAID_TYPES } from '@/lib/launch/allowlist';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Pure module unit tests — prove the gate behavior
// ---------------------------------------------------------------------------

describe('LB-PUBLIC: launch allowlist after gate removal', () => {
  const REAL = process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  beforeEach(() => { delete process.env.LOVEBLUEPRINT_BETA_USER_IDS; });
  afterAll(() => { if (REAL) process.env.LOVEBLUEPRINT_BETA_USER_IDS = REAL; });

  it('loveblueprint is still a launch type (paid product, not removed)', () => {
    expect(isLaunchType('loveblueprint')).toBe(true);
    expect(LAUNCH_PAID_TYPES).toContain('loveblueprint');
  });

  it('natal remains the only free launch type', () => {
    expect(LAUNCH_FREE_TYPES).toEqual(['natal']);
  });

  it('non-launch types remain blocked for everyone (404 path preserved)', () => {
    // These report types are NOT in the launch set — they must stay blocked
    // even after the beta allowlist is removed. This is the "unreleased report
    // types remain blocked" requirement.
    const banned = ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot'];
    for (const t of banned) {
      expect(isLaunchType(t)).toBe(false);
      const g = gateCheckout(t, '999');
      expect(g.allowed).toBe(false);
      expect(g.code).toBe('launch_unavailable');
      const gg = gateGeneration(t, '999');
      expect(gg.allowed).toBe(false);
      expect(gg.code).toBe('launch_unavailable');
    }
  });

  // ---- NEW BEHAVIOR: beta allowlist removed ----

  it('gateCheckout no longer blocks loveblueprint for non-allowlisted users', () => {
    // Before fix: gateCheckout('loveblueprint', 123) returns { allowed: false, code: 'beta_not_allowlisted' }
    // After fix: gateCheckout('loveblueprint', 123) returns { allowed: true }
    // (as long as the type is a launch type — which loveblueprint is)
    expect(gateCheckout('loveblueprint', '123').allowed).toBe(true);
    expect(gateCheckout('loveblueprint', '123').code).toBeUndefined();
  });

  it('gateCheckout allows loveblueprint for ANY authenticated user (no invite needed)', () => {
    // Prove that an ordinary user ID that was never in any beta allowlist
    // can now pass the checkout gate.
    for (const userId of ['1', '42', '999', 'ordinary-user']) {
      const g = gateCheckout('loveblueprint', userId);
      expect(g.allowed).toBe(true);
    }
  });

  it('gateGeneration no longer blocks loveblueprint for non-allowlisted users', () => {
    // The generation route must also stop rechecking beta membership.
    expect(gateGeneration('loveblueprint', '123').allowed).toBe(true);
    expect(gateGeneration('loveblueprint', '123').code).toBeUndefined();
  });

  it('gateGeneration still blocks non-launch types (unchanged behavior)', () => {
    expect(gateGeneration('transit', '1').allowed).toBe(false);
    expect(gateGeneration('transit', '1').code).toBe('launch_unavailable');
  });

  it('beta user ID env var is ignored (no allowlist check performed)', () => {
    // Even if the env var is set, the gate must NOT consult it.
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7,42,99';
    // The gate should allow loveblueprint for ANY user, regardless of allowlist.
    expect(gateCheckout('loveblueprint', '123').allowed).toBe(true);
    expect(gateCheckout('loveblueprint', '123').code).toBeUndefined();
    // Cleaning up
    delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  });

  it('natal checkout gate unchanged (free, no purchase required)', () => {
    expect(gateCheckout('natal', '123').allowed).toBe(true);
    expect(gateGeneration('natal', '123').allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Checkout route integration tests (real route, mocked Stripe/billing)
// ---------------------------------------------------------------------------

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ userId: '123' })),
  getUserById: jest.fn(async () => ({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' })),
}));
jest.mock('@/lib/billing/reportPurchase', () => ({
  createReportCheckoutSession: jest.fn(async () => ({ url: 'https://checkout.stripe.com/p/test123', purchaseId: 'pid-test-1', sessionId: 'si-test-1' })),
  isPaidReportType: (t: string) => t === 'loveblueprint' || t === 'transit' || t === 'vocation',
}));

const checkoutPost = require('@/app/api/billing/checkout-report/route').POST;

let verifyToken: jest.Mock;
let createCheckout: jest.Mock;
let getUserById: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  verifyToken = require('@/lib/auth').verifyToken;
  createCheckout = require('@/lib/billing/reportPurchase').createReportCheckoutSession;
  getUserById = require('@/lib/auth').getUserById;
});

function checkoutCall(body: any, tokenValue = 'tok') {
  return checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('LB-PUBLIC: checkout route — ordinary user can buy Love Blueprint', () => {
  const REAL = process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  afterAll(() => { if (REAL) process.env.LOVEBLUEPRINT_BETA_USER_IDS = REAL; else delete process.env.LOVEBLUEPRINT_BETA_USER_IDS; });

  it('signed-out users get 401 (auth gate preserved)', async () => {
    // Temporarily override the cookies mock to return no token
    const { cookies } = require('next/headers');
    const mockCookies = require('next/headers').cookies;
    mockCookies.mockResolvedValueOnce({ get: (k: string) => null });
    const res = await checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportType: 'loveblueprint' }),
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authentication required');
    // Restore
    mockCookies.mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) });
  });

  it('ordinary authenticated user can create Love Blueprint checkout (200 + Stripe URL)', async () => {
    // BEFORE FIX: this would return 403 "Love Blueprint is invite-only during beta."
    // AFTER FIX: this returns 200 with a Stripe checkout URL.
    verifyToken.mockReturnValue({ userId: '123' }); // ordinary user, never beta-allowlisted
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    expect(createCheckout).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(body.url).toContain('stripe') || expect(body.url).toContain('checkout');
    expect(body.purchaseId).toBeDefined();
    expect(body.amount).toBe(39); // $39 Love Blueprint price
  });

  it('checkout route does NOT call generation endpoint (checkout, not generation)', async () => {
    // The CTA must start checkout, not generation. This test proves the
    // checkout route is called and returns a Stripe URL, not a generation result.
    verifyToken.mockReturnValue({ userId: '123' });
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    // A generation response would have { success, status, readingId, reportId }
    // A checkout response has { url, purchaseId, amount }
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('purchaseId');
    expect(body).not.toHaveProperty('readingId');
    expect(body).not.toHaveProperty('reportId');
  });

  it('non-launch report types still rejected at checkout (404, unchanged)', async () => {
    verifyToken.mockReturnValue({ userId: '123' });
    for (const banned of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic']) {
      jest.clearAllMocks();
      createCheckout = require('@/lib/billing/reportPurchase').createReportCheckoutSession;
      const res = await checkoutCall({ reportType: banned });
      expect(res.status).toBe(404);
      expect(createCheckout).not.toHaveBeenCalled();
      const body = await res.json();
      expect(body.error).toContain('not available');
    }
  });

  it('free natal report is not treated as a paid checkout (route rejects non-paid types)', async () => {
    verifyToken.mockReturnValue({ userId: '123' });
    const res = await checkoutCall({ reportType: 'natal' });
    // natal is free, not a paid report — checkout-report route should reject it
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not a paid report');
    expect(createCheckout).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Generation route integration tests (real route, mocked DB/pipeline)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/reportFacts/integrate', () => ({
  buildVerifiedFactsForReport: async () => ({ ok: true, ledger: {} as any }),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchase: jest.fn(),
  consumeReportPurchase: jest.fn(),
  getReportPurchaseByUserIdAndType: jest.fn(),
  isValidPurchaseId: jest.fn((id: any) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
}));
jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => (t === 'transit' ? 'yearlytransit' : (t as any)),
  isUnsupportedForPipeline: (t: string) => ['synastry', 'composite', 'couples', 'tarot'].includes(t),
  dispatchReport: ((...a: any[]) => dispatched(...a)) as any,
}));

const generatePost = require('@/app/api/reports/generate/route').POST;
let dispatched: jest.Mock;
let getPurchase: jest.Mock;
let consume: jest.Mock;
let query: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
  getPurchase = require('@/lib/billing/reportPurchaseStore').getReportPurchase;
  consume = require('@/lib/billing/reportPurchaseStore').consumeReportPurchase;
  query = require('@/lib/db').query;
  query.mockImplementation(async (text: string) => {
    if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
    if (text.startsWith('INSERT INTO readings')) return { rows: [{ id: 99 }] };
    return { rows: [] };
  });
});

function genCall(body: any) {
  return generatePost(new Request('http://localhost/api/reports/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('LB-PUBLIC: generation route — paid reports still require verified purchase', () => {
  const CHART = { userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'paid', readingId: null, reportId: null };

  it('generation WITHOUT verified paid purchase fails (402) — even after gate removal', async () => {
    // This is the critical regression: removing the beta allowlist must NOT
    // accidentally allow free generation of paid reports. A user must still
    // have a verified paid purchase to generate loveblueprint.
    const res = await genCall({ type: 'loveblueprint' });
    // No purchaseId provided → 402 Payment Required
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('purchase is required');
    expect(getPurchase).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('generation with malformed purchaseId fails (400)', async () => {
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid purchase identifier');
  });

  it('generation with unpaid purchase fails (402)', async () => {
    getPurchase.mockResolvedValue({ userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'pending', readingId: null, reportId: null });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('not paid');
  });

  it('generation with wrong-user purchase fails (402)', async () => {
    getPurchase.mockResolvedValue({ userId: 999, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'paid', readingId: null, reportId: null });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('not owned by this account');
  });

  it('generation with wrong-SKU purchase fails (409)', async () => {
    getPurchase.mockResolvedValue({ userId: 123, reportType: 'transit', status: 'paid', readingId: null, reportId: null });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('does not match');
  });

  it('generation with already-consumed purchase returns existing reading (repeat resistance)', async () => {
    // The correlated check runs before consume — if a prior reading exists for this
    // purchase, return it directly without consuming again.
    query.mockImplementation(async (text: string) => {
      if (text.includes('JOIN readings')) return { rows: [{ reading_id: 55, report_id: 'rid-existing', pipeline_status: 'queued' }] };
      if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      return { rows: [] };
    });
    // Must also mock getPurchase to return a valid purchase so the
    // purchase validation passes before we reach the correlated check.
    getPurchase.mockResolvedValue({ userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'paid', readingId: null, reportId: null });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('queued');
    expect(body.readingId).toBe(55);
    expect(body.reportId).toBe('rid-existing');
    expect(dispatched).not.toHaveBeenCalled(); // no double dispatch
  });

  it('generation with valid paid purchase succeeds (200, dispatches to pipeline)', async () => {
    getPurchase.mockResolvedValue(CHART);
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-new', readingResult: JSON.stringify({ reportType: 'loveblueprint', birthData: {} }), readingStatus: 'queued' });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.status).toBe('queued');
    expect(body.readingId).toBe(99);
  });

  it('natal (free) generation continues to work without purchase', async () => {
    const res = await genCall({ type: 'natal' });
    expect(res.status).toBe(200);
    expect(getPurchase).not.toHaveBeenCalled();
    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('unreleased report types remain blocked at generation (404)', async () => {
    for (const banned of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot']) {
      jest.clearAllMocks();
      dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
      const res = await genCall({ type: banned, purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      expect(res.status).toBe(404);
      expect(dispatched).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// UI tests — prove Love Blueprint CTA starts checkout, not generation
// ---------------------------------------------------------------------------

describe('LB-PUBLIC: ReportsView UI — Love Blueprint CTA calls checkout', () => {
  it('ReportsView no longer says "invite-only" or "REQUEST INVITE" for Love Blueprint', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/reports/ReportsView.tsx'),
      'utf8',
    );
    // After fix: the Love Blueprint card should not mention invite-only
    expect(src).not.toContain('invite-only during the private beta');
    expect(src).not.toContain('REQUEST INVITE');
    // The CTA should mention purchase/checkout/pay/buy instead
    expect(src).toContain('loveblueprint');
  });

  it('ReportsView generate function still handles free natal generation (unchanged path)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/reports/ReportsView.tsx'),
      'utf8',
    );
    // Natal generation must still work via /api/reports/generate
    expect(src).toContain("generate('natal')");
    expect(src).toContain('/api/reports/generate');
  });
});

describe('LB-PUBLIC: pricing page — no invite-only wording', () => {
  it('pricing page does not say "available by invite during beta"', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/pricing/page.tsx'),
      'utf8',
    );
    expect(src).not.toContain('Available by invite during beta');
    expect(src).not.toContain('invite-only');
    expect(src).not.toContain('Join the waitlist');
  });

  it('pricing page lists Love Blueprint as a paid product with price', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/pricing/page.tsx'),
      'utf8',
    );
    // Should mention the price and that it's available
    expect(src).toContain('Love Blueprint');
    // Should NOT say "not yet publicly priced"
    expect(src).not.toContain('Not yet publicly priced');
  });
});

describe('LB-PUBLIC: terms page — no invite-only wording', () => {
  it('terms page does not say Love Blueprint is invite-only', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/terms/page.tsx'),
      'utf8',
    );
    expect(src).not.toContain('offered during beta by invite');
    expect(src).not.toContain('invite-only');
  });
});

describe('LB-PUBLIC: services page — no invite-only wording', () => {
  it('services page does not say Love Blueprint is invite-only', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src/app/services/page.tsx'),
      'utf8',
    );
    expect(src).not.toContain('invite-only Love Blueprint');
    expect(src).not.toContain('Available by invite');
  });
});
