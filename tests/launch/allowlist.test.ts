// PIKE L3 — server-side launch allowlist acceptance tests (UPDATED for LB-PUBLIC).
//
// After the beta allowlist removal (LB-PUBLIC hotfix), the gate functions no
// longer consult user IDs. The tests below reflect the new contract:
//  - Love Blueprint is publicly available (no user-ID gate)
//  - Non-launch types remain blocked
//  - gateCheckout/gateGeneration signatures still accept userId for backward
//    compatibility but ignore it

import {
  isLaunchType,
  gateCheckout,
  gateGeneration,
} from '@/lib/launch/allowlist';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Pure module unit tests
// ---------------------------------------------------------------------------

describe('launch allowlist (pure) — after LB-PUBLIC gate removal', () => {
  it('only natal + loveblueprint are launch types', () => {
    expect(isLaunchType('natal')).toBe(true);
    expect(isLaunchType('loveblueprint')).toBe(true);
    for (const t of ['transit', 'relationship', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic', 'synastry', 'composite', 'couples', 'tarot']) {
      expect(isLaunchType(t)).toBe(false);
    }
  });

  it('beta allowlist functions removed — gate does not consult user IDs', () => {
    // After LB-PUBLIC: getLoveBlueprintBetaUserIds and isLoveBlueprintBetaUser
    // are removed. The gates no longer check user IDs.
    // gateCheckout and gateGeneration accept _userId param for backward compat
    // but ignore it.
    expect(gateCheckout('loveblueprint', 123).allowed).toBe(true);
    expect(gateCheckout('loveblueprint', 123).code).toBeUndefined();
    expect(gateGeneration('loveblueprint', 123).allowed).toBe(true);
    expect(gateGeneration('loveblueprint', 123).code).toBeUndefined();
  });

  it('gateCheckout passes userId param for backward compatibility (ignored)', () => {
    // The _userId param is kept for signature compatibility but is ignored.
    // Any userId (or no userId) produces the same result.
    expect(gateCheckout('loveblueprint', 7).allowed).toBe(true);
    expect(gateCheckout('loveblueprint', 123).allowed).toBe(true);
    expect(gateCheckout('loveblueprint', 'any-id').allowed).toBe(true);
    expect(gateCheckout('natal', 7).allowed).toBe(true);
  });

  it('gateCheckout blocks non-launch types for everyone', () => {
    expect(gateCheckout('transit', 7).allowed).toBe(false);
    expect(gateCheckout('transit', 7).code).toBe('launch_unavailable');
    expect(gateCheckout('fullcosmic', 7).allowed).toBe(false);
  });

  it('gateGeneration blocks non-launch types for everyone', () => {
    expect(gateGeneration('transit', 7).allowed).toBe(false);
    expect(gateGeneration('transit', 7).code).toBe('launch_unavailable');
    expect(gateGeneration('fullcosmic', 7).allowed).toBe(false);
  });

  it('gateGeneration allows launch types regardless of userId', () => {
    expect(gateGeneration('natal', 123).allowed).toBe(true);
    expect(gateGeneration('loveblueprint', 123).allowed).toBe(true);
    expect(gateGeneration('loveblueprint', 7).allowed).toBe(true);
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

describe('checkout route: post-LB-PUBLIC gates', () => {
  it('#1 non-allowlisted user CAN create a Love Blueprint checkout (public product)', async () => {
    // After LB-PUBLIC: any authenticated user can checkout, no invite needed.
    verifyToken.mockReturnValue({ userId: '123' }); // a "non-allowlisted" id
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

  it('authentication gate still enforced (401 when no token)', async () => {
    const { cookies } = require('next/headers');
    const mockCookies = require('next/headers').cookies;
    mockCookies.mockResolvedValueOnce({ get: (k: string) => null });
    const res = await checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportType: 'loveblueprint' }),
    }));
    expect(res.status).toBe(401);
    mockCookies.mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) });
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

describe('generate route: post-LB-PUBLIC gates', () => {
  it('non-allowlisted user CAN generate Love Blueprint with a paid purchase', async () => {
    // After LB-PUBLIC: the beta membership gate is removed.
    // Any authenticated user with a valid paid purchase can generate.
    verifyToken.mockReturnValue({ userId: '7' });
    getPurchase.mockResolvedValue(CHART);
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
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

  it('#5 a client `tier` cannot downgrade loveblueprint to free (still requires a paid purchase)', async () => {
    verifyToken.mockReturnValue({ userId: '7' });
    const res = await genCall({ type: 'loveblueprint', tier: 'free' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('paid flow: loveblueprint with a valid purchase dispatches once (200)', async () => {
    verifyToken.mockReturnValue({ userId: '7' });
    getPurchase.mockResolvedValue(CHART);
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('no beta user IDs or secrets leak into any client-visible payload', async () => {
    // Even if the env var were set (it's not used anymore), no user IDs leak.
    const res = await genCall({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    if (res.status === 200) {
      const body = await res.json();
      expect(body).not.toHaveProperty('betaUserId');
      expect(body).not.toHaveProperty('allowlist');
    }
  });
});
