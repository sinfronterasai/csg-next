// Route-level tests for POST /api/reports/generate focusing on the two critical
// fixes: #1 (server-side entitlement, never trust request JSON) and #2 (fail
// closed on non-2xx n8n dispatch).
import { POST } from '@/app/api/reports/generate/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: '7' }),
  getUserById: async () => ({ id: 7, first_name: 'A', role: 'customer' }),
}));
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}));
jest.mock('@/lib/reportVerifiedFacts', () => ({
  extractVerifiedFacts: async () => ({ natalChart: {} }),
}));
jest.mock('@/lib/profile/store', () => ({
  setReadingDispatchFailed: jest.fn(async () => {}),
}));

let dispatched: jest.Mock;
let entitled: jest.Mock;
let query: jest.Mock;

jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => (t === 'transit' ? 'yearlytransit' : (t as any)),
  isUnsupportedForPipeline: (t: string) => ['synastry', 'composite', 'couples', 'tarot'].includes(t),
  dispatchReport: (...a: any[]) => dispatched(...a),
}));
jest.mock('@/lib/reportEntitlement', () => ({
  isPaidReport: (t: string) => t === 'transit' || t === 'fullcosmic',
  userEntitledForReport: (...a: any[]) => entitled(...a),
}));

const CHART = {
  birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris',
  unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris',
};

function setup(entitlementResult: { entitled: boolean; requiredTier?: any; reason?: string }, dispatchResult = { ok: true, status: 200 }) {
  dispatched = jest.fn(async () => dispatchResult);
  entitled = jest.fn(async () => entitlementResult);
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

describe('#1 server-side entitlement (no request JSON trust)', () => {
  it('paid report without entitlement -> 402 and never dispatches', async () => {
    setup({ entitled: false, requiredTier: 'premium', reason: 'tier=free' });
    const res = await call({ type: 'transit' });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('client cannot forge entitlement via request body', async () => {
    setup({ entitled: false, requiredTier: 'premium' });
    const res = await call({ type: 'transit', entitlementVerified: true });
    expect(res.status).toBe(402);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('entitled paid report dispatches to n8n', async () => {
    setup({ entitled: true, requiredTier: 'premium' });
    const res = await call({ type: 'transit' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
    const arg = dispatched.mock.calls[0][0];
    expect(arg.reportType).toBe('transit');
    expect(arg.tier).toBe('paid');
  });

  it('free report dispatches without entitlement check', async () => {
    setup({ entitled: false }); // would fail paid, but free skips it
    const res = await call({ type: 'natal' });
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
  });
});

describe('#2 fail closed on non-2xx dispatch', () => {
  it('n8n 401 leaves report rejected and returns 502', async () => {
    setup({ entitled: true, requiredTier: 'premium' }, { ok: false, status: 401 });
    const setFailed = require('@/lib/profile/store').setReadingDispatchFailed;
    const res = await call({ type: 'transit' });
    expect(res.status).toBe(502);
    expect(setFailed).toHaveBeenCalledWith(99);
  });

  it('n8n 500 leaves report rejected and returns 502', async () => {
    setup({ entitled: true, requiredTier: 'premium' }, { ok: false, status: 500 });
    const res = await call({ type: 'transit' });
    expect(res.status).toBe(502);
  });
});
