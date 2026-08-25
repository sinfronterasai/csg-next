// Route-level tests for POST /api/reports/generate under the pay-per-report model.
// Entitlement comes ONLY from a server-verified purchase record. Subscription
// tier / tarot entitlements must NOT grant report generation.
import { POST } from '@/app/api/reports/generate/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: '7' }),
  getUserById: async () => ({ id: 7, first_name: 'A', email: 'a@x.com', role: 'customer' }),
}));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/reportVerifiedFacts', () => ({
  extractVerifiedFacts: async () => ({ natalChart: {} }),
}));
jest.mock('@/lib/profile/store', () => ({
  setReadingDispatchFailed: jest.fn(async () => {}),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchase: jest.fn(),
  consumeReportPurchase: jest.fn(),
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

beforeEach(() => { jest.clearAllMocks(); });

function setup(opts: { purchase?: any; dispatchResult?: any } = {}) {
  dispatched = jest.fn(async () => opts.dispatchResult ?? { ok: true, status: 200 });
  getPurchase = require('@/lib/billing/reportPurchaseStore').getReportPurchase;
  consume = require('@/lib/billing/reportPurchaseStore').consumeReportPurchase;
  getPurchase.mockResolvedValue(opts.purchase ?? null);
  consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1' });
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
    headers: { 'content-length': String(JSON.stringify(body).length) },
    body: JSON.stringify(body),
  }));
}

describe('commercial model: subscription/tarot do NOT grant reports', () => {
  it('paid report with no purchaseId -> 402 (subscription alone is irrelevant)', async () => {
    setup(); // no purchase lookup will matter; route rejects before looking
    const res = await call({ type: 'transit' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('paid report with bogus purchaseId -> 402 (not owned / not found)', async () => {
    setup({ purchase: null });
    const res = await call({ type: 'transit', purchaseId: 'bogus' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });
});

describe('purchase verification gates dispatch', () => {
  const paidPurchase = {
    userId: 7, reportType: 'transit', status: 'paid',
    readingId: null, reportId: null,
  };

  it('matching paid purchase dispatches once (200 + 1 dispatch)', async () => {
    setup({ purchase: paidPurchase });
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ purchaseId: 'p-1', userId: 7, reportType: 'transit' }));
  });

  it('wrong user owns the purchase -> 402', async () => {
    setup({ purchase: { ...paidPurchase, userId: 999 } });
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('purchase for a different report type (SKU mismatch) -> 409', async () => {
    setup({ purchase: { ...paidPurchase, reportType: 'fullcosmic' } });
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('unpaid (pending) purchase -> 402', async () => {
    setup({ purchase: { ...paidPurchase, status: 'pending' } });
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
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

  it('repeat request for an already-consumed purchase returns same correlation, no re-dispatch', async () => {
    setup({ purchase: { ...paidPurchase, status: 'consumed', readingId: 99, reportId: 'rid-1' } });
    // getReportPurchase returns consumed; route short-circuits before dispatch.
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readingId).toBe(99);
    expect(body.reportId).toBe('rid-1');
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('consume reports already_correlated (race) -> no re-dispatch, returns winning correlation', async () => {
    setup({ purchase: paidPurchase });
    consume.mockResolvedValueOnce({ outcome: 'already_correlated', readingId: 88, reportId: 'rid-other' });
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readingId).toBe(88);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('n8n 401 after a valid purchase leaves report rejected + 502', async () => {
    setup({ purchase: paidPurchase, dispatchResult: { ok: false, status: 401 } });
    const setFailed = require('@/lib/profile/store').setReadingDispatchFailed;
    const res = await call({ type: 'transit', purchaseId: 'p-1' });
    expect(res.status).toBe(502);
    expect(setFailed).toHaveBeenCalledWith(99);
  });
});
