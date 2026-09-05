// Route-level tests for POST /api/reports/generate under the pay-per-report model
// + payment-integrity review. Entitlement comes ONLY from a server-verified
// purchase record. Subscription tier / tarot entitlements do NOT grant reports.
// A malformed (non-UUID) purchaseId must 400 without a DB hit. A repeat request
// for an already-consumed purchase returns the EXISTING correlation with the
// reading's ACTUAL status (never a fake "queued").
import { POST } from '@/app/api/reports/generate/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: '7' }),
  getUserById: async () => ({ id: 7, first_name: 'A', email: 'a@x.com', role: 'customer' }),
}));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const V2_LEDGER = {
  schemaVersion: 'csg-report-facts-v2', reportType: 'natal', asOfDate: '2026-01-01',
  common: { chartRuler: { planet: 'moon', label: 'Moon', sign: 'cancer', condition: 'x', display: 'x' }, aspects: [], patterns: [], elements: {}, modalities: {}, moonPhase: { phase: 0.5, label: 'Full Moon' }, northNode: { sign: 'cancer', signLabel: 'Cancer', degreeInSign: 1, longitude: 91, house: null, retrograde: false, dignity: null, display: 'x' }, southNode: { sign: 'capricorn', signLabel: 'Capricorn', degreeInSign: 1, longitude: 271, house: null, retrograde: false, dignity: null, display: 'x' }, juno: { sign: 'cancer', signLabel: 'Cancer', degreeInSign: 1, longitude: 91, house: null, retrograde: false, dignity: null, display: 'x' }, partOfFortune: { sign: 'cancer', signLabel: 'Cancer', degreeInSign: 1, longitude: 91, house: null, retrograde: false, dignity: null, display: 'x' }, ascendant: { sign: 'cancer', signLabel: 'Cancer', degreeInSign: 1, house: 1 }, descendant: { sign: 'capricorn', signLabel: 'Capricorn', degreeInSign: 1, house: 7 }, midheaven: { sign: 'pisces', signLabel: 'Pisces', degreeInSign: 1, house: 10 }, icumcoeli: { sign: 'virgo', signLabel: 'Virgo', degreeInSign: 1, house: 4 }, topAspectByBody: {} },
  facts: {}, reportData: {},
};
jest.mock('@/lib/reportFacts/integrate', () => ({
  buildVerifiedFactsForReport: async () => ({ ok: true, ledger: V2_LEDGER }),
}));
jest.mock('@/lib/profile/store', () => ({
  setReadingDispatchFailed: jest.fn(async () => {}),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchase: jest.fn(),
  consumeReportPurchase: jest.fn(),
  isValidPurchaseId: jest.fn((id: any) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
}));

let dispatched: jest.Mock;
let query: jest.Mock;
let getPurchase: jest.Mock;
let consume: jest.Mock;

jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => (t === 'transit' ? 'yearlytransit' : (t as any)),
  isUnsupportedForPipeline: (t: string) => ['synastry', 'composite', 'couples', 'tarot'].includes(t),
  dispatchReport: (...a: any[]) => dispatched(...a),
}));

const CHART = {
  birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris',
  unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris',
};

beforeEach(() => {
  jest.clearAllMocks();
  // These legacy entitlement tests exercise behavior *after* the independent
  // controlled-beta gate, so their stable test user must be allowlisted.
  process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
});

function setup(opts: { purchase?: any; consumeResult?: any; dispatchResult?: any } = {}) {
  dispatched = jest.fn(async () => opts.dispatchResult ?? { ok: true, status: 200 });
  getPurchase = require('@/lib/billing/reportPurchaseStore').getReportPurchase;
  consume = require('@/lib/billing/reportPurchaseStore').consumeReportPurchase;
  getPurchase.mockResolvedValue(opts.purchase ?? null);
  consume.mockResolvedValue(opts.consumeResult ?? { outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
  query = require('@/lib/db').query;
  query.mockImplementation(async (text: string) => {
    if (text.includes('natal_charts')) return { rows: [CHART] };
    if (text.startsWith('INSERT INTO readings')) return { rows: [{ id: 99 }] };
    return { rows: [] };
  });
}

function call(body: any) {
  return POST(new Request('http://localhost/api/reports/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('commercial model: subscription/tarot do NOT grant reports', () => {
  it('paid report with no purchaseId -> 402', async () => {
    setup();
    const res = await call({ type: 'loveblueprint' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('paid report with bogus (non-UUID) purchaseId -> 400, no DB call', async () => {
    setup();
    const res = await call({ type: 'loveblueprint', purchaseId: 'bogus' });
    expect(res.status).toBe(400);
    expect(getPurchase).not.toHaveBeenCalled(); // UUID rejected before DB
    expect(dispatched).not.toHaveBeenCalled();
  });
});

describe('purchase verification gates dispatch', () => {
  const paidPurchase = { userId: 7, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'paid', readingId: null, reportId: null };

  it('matching paid purchase dispatches once (200 + 1 dispatch)', async () => {
    setup({ purchase: paidPurchase });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 7, reportType: 'loveblueprint' }));
  });
  it('wrong user owns the purchase -> 402', async () => {
    setup({ purchase: { ...paidPurchase, userId: 999 } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('purchase for a different report type (SKU mismatch) -> 409', async () => {
    setup({ purchase: { ...paidPurchase, reportType: 'fullcosmic' } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('unpaid (pending) purchase -> 402', async () => {
    setup({ purchase: { ...paidPurchase, status: 'pending' } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('free report (natal) dispatches without any purchase', async () => {
    setup();
    const res = await call({ type: 'natal' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(getPurchase).not.toHaveBeenCalled();
  });

  it('repeat request for an already-consumed purchase returns SAME correlation, no re-dispatch', async () => {
    setup({ purchase: paidPurchase, consumeResult: { outcome: 'already_correlated', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readingId).toBe(99);
    expect(body.reportId).toBe('rid-1');
    expect(body.status).toBe('queued');
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('repeat after a failed dispatch returns the ACTUAL dispatch_failed status (no fake queued)', async () => {
    setup({ purchase: paidPurchase, consumeResult: { outcome: 'already_correlated', readingId: 99, reportId: 'rid-1', readingStatus: 'dispatch_failed' } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    const body = await res.json();
    expect(body.status).toBe('dispatch_failed');
    expect(body.retryAvailable).toBe(true);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('consume reports already_correlated (race) -> no re-dispatch, returns winning correlation', async () => {
    setup({ purchase: paidPurchase, consumeResult: { outcome: 'already_correlated', readingId: 88, reportId: 'rid-other', readingStatus: 'queued' } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readingId).toBe(88);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('n8n 401 after a valid purchase leaves report rejected + 502', async () => {
    setup({ purchase: paidPurchase, dispatchResult: { ok: false, status: 401 } });
    const res = await call({ type: 'loveblueprint', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
    expect(res.status).toBe(502);
    // The route marks the reading dispatch_failed (retryable) via a direct query UPDATE.
    const q = require('@/lib/db').query as jest.Mock;
    const failCalls = q.mock.calls.filter((c: any[]) => String(c[0]).includes("pipeline_status = 'dispatch_failed'"));
    expect(failCalls.length).toBe(1);
    expect(failCalls[0][1]).toEqual([99]);
  });
});
