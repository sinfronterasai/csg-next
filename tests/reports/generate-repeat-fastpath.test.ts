// R2-B8 — route fast-path repeat test. When a paid purchase is ALREADY correlated
// to a reading, the generate route must return the stored reading IMMEDIATELY:
// no VerifiedFactsV2 build, no purchase consume, no n8n dispatch. (The paid path
// sources the chart from the stored natal_charts row, so the chart-engine spy is
// not needed; the build/consume/dispatch mocks below are the load-bearing asserts.)
import { POST } from '@/app/api/reports/generate/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: '7' }),
  getUserById: async () => ({ id: 7, first_name: 'A', email: 'a@x.com', role: 'customer' }),
}));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const buildVerifiedFactsForReport = jest.fn(async () => ({ ok: true, ledger: {} as any }));
jest.mock('@/lib/reportFacts/integrate', () => ({
  buildVerifiedFactsForReport: ((...a: any[]) => (buildVerifiedFactsForReport as any)(...a)) as any,
}));
jest.mock('@/lib/profile/store', () => ({ setReadingDispatchFailed: jest.fn(async () => {}) }));
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

let dispatched: jest.Mock;
let query: jest.Mock;
let getPurchase: jest.Mock;
let consume: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  buildVerifiedFactsForReport.mockClear();
  // This suite tests repeat/correlation behavior beyond the beta gate.
  process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
});

function setupRepeat() {
  dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
  getPurchase = require('@/lib/billing/reportPurchaseStore').getReportPurchase;
  consume = require('@/lib/billing/reportPurchaseStore').consumeReportPurchase;
  getPurchase.mockResolvedValue({ id: 'p-1', status: 'paid', userId: 7, reportType: 'loveblueprint', sku: 'report-loveblueprint', price: '4.99', created_at: '2026-01-01' });
  consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-1', readingStatus: 'queued' });
  query = require('@/lib/db').query;
  // The correlation SELECT returns an existing reading => repeat fast path.
  query.mockImplementation(async (text: string) => {
    if (text.includes('FROM report_orders o JOIN readings r')) return { rows: [{ reading_id: 99, report_id: 'rid-1', pipeline_status: 'approved' }] };
    return { rows: [] };
  });
}

function call(body: any) {
  return POST(new Request('http://localhost/api/reports/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

describe('R2-B8 — repeat fast path (no build/consume/dispatch)', () => {
  it('returns the stored reading without building the ledger, consuming, or dispatching', async () => {
    setupRepeat();
    const res = await call({ purchaseId: '11111111-1111-1111-1111-111111111111', type: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('repeat');
    expect(buildVerifiedFactsForReport).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalled(); // the correlation peek ran
  });

  it('non-repeat path DOES build the ledger, consume, and dispatch (contrast)', async () => {
    dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
    getPurchase = require('@/lib/billing/reportPurchaseStore').getReportPurchase;
    consume = require('@/lib/billing/reportPurchaseStore').consumeReportPurchase;
    getPurchase.mockResolvedValue({ id: 'p-2', status: 'paid', userId: 7, reportType: 'loveblueprint', sku: 'report-loveblueprint', price: '4.99', created_at: '2026-01-01' });
    consume.mockResolvedValue({ outcome: 'consumed', readingId: 99, reportId: 'rid-2', readingStatus: 'queued' });
    query = require('@/lib/db').query;
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM report_orders o JOIN readings r')) return { rows: [] }; // no existing correlation
      if (text.includes('natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      if (text.startsWith('INSERT INTO readings')) return { rows: [{ id: 99 }] };
      return { rows: [] };
    });
    const res = await call({ purchaseId: '22222222-2222-2222-2222-222222222222', type: 'loveblueprint' });
    expect(res.status).toBe(200);
    expect(buildVerifiedFactsForReport).toHaveBeenCalled();
    expect(consume).toHaveBeenCalled();
    expect(dispatched).toHaveBeenCalled();
  });
});
