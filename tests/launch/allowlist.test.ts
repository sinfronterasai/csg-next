// PIKE L3 — server-side launch allowlist acceptance tests.
//
// These are the six acceptance criteria from PIKE-L3-LAUNCH-ALLOWLIST-BRIEF.md:
//  1. non-allowlisted user cannot create a Love Blueprint checkout;
//  2. allowlisted user can enter the normal paid checkout flow;
//  3. no user can buy any report other than natal/loveblueprint;
//  4. Natal remains free and never requires Stripe;
//  5. changing request `tier` cannot downgrade or unlock a product;
//  6. no beta user IDs or secrets are exposed in any client-visible payload.
//
// The gate itself is unit-tested directly, then exercised through the real
// checkout and generate routes (with DB/Stripe/billing mocks) so the assertion
// lives in the actual server request path, not just the helper.

import {
  isLaunchType,
  getLoveBlueprintBetaUserIds,
  isLoveBlueprintBetaUser,
  gateCheckout,
  gateGeneration,
} from '@/lib/launch/allowlist';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Pure module unit tests
// ---------------------------------------------------------------------------

describe('launch allowlist (pure)', () => {
  const REAL = process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  beforeEach(() => { delete process.env.LOVEBLUEPRINT_BETA_USER_IDS; });
  afterAll(() => { if (REAL) process.env.LOVEBLUEPRINT_BETA_USER_IDS = REAL; });

  it('only natal + loveblueprint are launch types', () => {
    expect(isLaunchType('natal')).toBe(true);
    expect(isLaunchType('loveblueprint')).toBe(true);
    for (const t of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot']) {
      expect(isLaunchType(t)).toBe(false);
    }
  });

  it('beta allowlist is EMPTY by default (no env)', () => {
    expect(getLoveBlueprintBetaUserIds().size).toBe(0);
    expect(isLoveBlueprintBetaUser(7)).toBe(false);
    expect(isLoveBlueprintBetaUser('7')).toBe(false);
  });

  it('beta allowlist is keyed by stable internal user ID, not email', () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7, 42 , 99';
    const ids = getLoveBlueprintBetaUserIds();
    expect(ids.has('7')).toBe(true);
    expect(ids.has('42')).toBe(true);
    expect(ids.has('99')).toBe(true);
    // Email-shaped input must never match an ID key.
    expect(isLoveBlueprintBetaUser('someone@example.com')).toBe(false);
    // Unknown id is not allowlisted.
    expect(isLoveBlueprintBetaUser('123')).toBe(false);
  });

  it('gateCheckout blocks non-launch types for everyone', () => {
    expect(gateCheckout('transit', 7).allowed).toBe(false);
    expect(gateCheckout('transit', 7).code).toBe('launch_unavailable');
    expect(gateCheckout('fullcosmic', 7).allowed).toBe(false);
  });

  it('gateCheckout blocks loveblueprint for non-allowlisted, allows allowlisted', () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
    expect(gateCheckout('loveblueprint', 123).allowed).toBe(false);
    expect(gateCheckout('loveblueprint', 123).code).toBe('beta_not_allowlisted');
    expect(gateCheckout('loveblueprint', 7).allowed).toBe(true);
    expect(gateCheckout('natal', 123).allowed).toBe(true); // free, no beta needed
  });

  it('gateGeneration allows only launch types and rechecks beta membership', () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
    expect(gateGeneration('natal', 123).allowed).toBe(true);
    expect(gateGeneration('loveblueprint', 7).allowed).toBe(true);
    expect(gateGeneration('loveblueprint', 123).code).toBe('beta_not_allowlisted');
    expect(gateGeneration('transit', 7).allowed).toBe(false);
    expect(gateGeneration('transit', 7).code).toBe('launch_unavailable');
  });
});

// ---------------------------------------------------------------------------
// Checkout route (real route, billing/Stripe mocked)
// ---------------------------------------------------------------------------

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ userId: '7' })),
  getUserById: jest.fn(async () => ({ id: 7, first_name: 'A', email: 'a@x.com', role: 'customer' })),
}));
jest.mock('@/lib/billing/reportPurchase', () => ({
  createReportCheckoutSession: jest.fn(async () => ({ url: 'https://pay.stripe.example/c/xyz', purchaseId: 'pid-1' })),
  isPaidReportType: (t: string) => t === 'loveblueprint',
}));

const checkoutPost = require('@/app/api/billing/checkout-report/route').POST;

let verifyToken: jest.Mock;
let createCheckout: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  verifyToken = require('@/lib/auth').verifyToken;
  createCheckout = require('@/lib/billing/reportPurchase').createReportCheckoutSession;
});

function checkoutCall(body: any) {
  return checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('checkout route: L3 gates', () => {
  const REAL = process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  afterAll(() => { if (REAL) process.env.LOVEBLUEPRINT_BETA_USER_IDS = REAL; else delete process.env.LOVEBLUEPRINT_BETA_USER_IDS; });

  it('#1 non-allowlisted user cannot create a Love Blueprint checkout (403, no Stripe session)', async () => {
    delete process.env.LOVEBLUEPRINT_BETA_USER_IDS; // nobody is allowlisted
    verifyToken.mockReturnValue({ userId: '123' }); // a non-allowlisted id
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(403);
    expect(createCheckout).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ error: 'Love Blueprint is invite-only during beta.' });
  });

  it('#2 allowlisted user enters the normal paid checkout flow (200 + Stripe url)', async () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
    verifyToken.mockReturnValue({ userId: '7' });
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    expect(createCheckout).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(body.url).toContain('stripe');
    expect(body.purchaseId).toBe('pid-1');
    expect(body.amount).toBe(39); // $39 existing R3 price
  });

  it('#3 no user can buy a non-launch type (404, no Stripe session)', async () => {
    for (const banned of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot']) {
      jest.clearAllMocks();
      createCheckout = require('@/lib/billing/reportPurchase').createReportCheckoutSession;
      const res = await checkoutCall({ reportType: banned });
      expect(res.status).toBe(404);
      expect(createCheckout).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// Generate route (real route, billing/db/pipeline mocked)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/reportFacts/integrate', () => ({
  buildVerifiedFactsForReport: async () => ({ ok: true, ledger: {} as any }),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchase: jest.fn(),
  consumeReportPurchase: jest.fn(),
  isValidPurchaseId: jest.fn((id: any) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
}));
jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => (t === 'transit' ? 'yearlytransit' : (t as any)),
  isUnsupportedForPipeline: (t: string) => ['synastry', 'composite', 'couples', 'tarot'].includes(t),
  dispatchReport: ((...a: any[]) => dispatched(...a)) as any,
}));

const generatePost = require('@/app/api/reports/generate/route').POST;
let dispatched: jest.Mock;
let query: jest.Mock;
let getPurchase: jest.Mock;
let consume: jest.Mock;

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

const CHART = { userId: 7, reportType: 'loveblueprint', status: 'paid', readingId: null, reportId: null };

describe('generate route: L3 gates', () => {
  it('non-allowlisted user cannot generate Love Blueprint even with a paid purchase', async () => {
    delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
    verifyToken.mockReturnValue({ userId: '7' });
    getPurchase.mockResolvedValue(CHART);
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(403);
    expect(getPurchase).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('#3 no user can GENERATE a non-launch type (404, no dispatch)', async () => {
    for (const banned of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot']) {
      jest.clearAllMocks();
      dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
      const res = await genCall({ type: banned, purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
      expect(res.status).toBe(404);
      expect(dispatched).not.toHaveBeenCalled();
    }
  });

  it('#4 Natal remains free and never requires Stripe (200, no purchase/dispatch needed)', async () => {
    const res = await genCall({ type: 'natal' });
    expect(res.status).toBe(200);
    expect(getPurchase).not.toHaveBeenCalled(); // free path never looks up a purchase
  });

  it('#5 a client `tier` cannot upgrade natal to paid (still free, 200)', async () => {
    const res = await genCall({ type: 'natal', tier: 'premium_plus' });
    expect(res.status).toBe(200);
    expect(getPurchase).not.toHaveBeenCalled();
    expect(dispatched).toHaveBeenCalledTimes(1); // free dispatch, unbilled
  });

  it('#5 a client `tier` cannot downgrade loveblueprint to free (still requires a paid purchase)', async () => {
    // First pass the independent beta-membership gate, then prove client tier
    // still cannot bypass the paid-purchase requirement.
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
    verifyToken.mockReturnValue({ userId: '7' });
    const res = await genCall({ type: 'loveblueprint', tier: 'free' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('#2/#3 allowlisted paid flow: loveblueprint with a valid purchase dispatches once (200)', async () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
    verifyToken.mockReturnValue({ userId: '7' });
    getPurchase.mockResolvedValue(CHART);
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('#6 no beta user IDs or secrets leak into any client-visible payload', async () => {
    process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7,secret-user-999';
    const secret = 'secret-user-999';
    // Non-allowlisted checkout attempt.
    const cRes = await checkoutCall({ reportType: 'loveblueprint' });
    const cBody = JSON.stringify(await cRes.json());
    expect(cBody).not.toContain(secret);
    expect(cBody).not.toContain('LOVEBLUEPRINT_BETA_USER_IDS');
    // Allowlisted checkout success (user 7) — payload must not echo the beta id.
    verifyToken.mockReturnValue({ userId: '7' });
    const okRes = await checkoutCall({ reportType: 'loveblueprint' });
    const okBody = JSON.stringify(await okRes.json());
    expect(okRes.status).toBe(200);
    expect(okBody).not.toContain(secret);
    expect(okBody).not.toContain('LOVEBLUEPRINT_BETA_USER_IDS');
    // Generation 404 for a banned type must not echo the beta id either.
    const gRes = await genCall({ type: 'transit', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    const gBody = JSON.stringify(await gRes.json());
    expect(gBody).not.toContain(secret);
    expect(gBody).not.toContain('LOVEBLUEPRINT_BETA_USER_IDS');
    delete process.env.LOVEBLUEPRINT_BETA_USER_IDS;
  });
});
