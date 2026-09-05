// Retry route tests: terminal-only (r2), atomic claim (r3), immutable snapshot (r4).
import { POST } from '@/app/api/reports/[id]/retry/route';

jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }) }));
jest.mock('@/lib/auth', () => ({ verifyToken: () => ({ userId: '7' }), getUserById: async () => ({ id: 7, first_name: 'A', email: 'a@x.com', role: 'customer' }) }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchaseByReadingId: jest.fn(),
  claimRetry: jest.fn(),
  markReadingDispatchFailed: jest.fn(async () => {}),
}));

let dispatched: jest.Mock;
let query: jest.Mock;
let claim: jest.Mock;

jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => t,
  isUnsupportedForPipeline: (t: string) => t === 'synastry',
  dispatchReport: (...a: any[]) => dispatched(...a),
}));

const READING = (status: string, snapshot: any, reportType = 'loveblueprint') => ({
  id: 50, user_id: 7, type: reportType, title: 'T',
  result: { reportId: 'rid-1', reportType, metadata: snapshot },
  pipeline_status: status,
});

function setup(opts: { status?: string; snapshot?: any; claimResult?: boolean; dispatchResult?: any; purchase?: any; reportType?: string } = {}) {
  dispatched = jest.fn(async () => opts.dispatchResult ?? { ok: true, status: 200 });
  claim = require('@/lib/billing/reportPurchaseStore').claimRetry;
  claim.mockResolvedValue({ claimed: opts.claimResult ?? true });
  query = require('@/lib/db').query;
  query.mockImplementation(async (text: string) => {
    if (text.includes('FROM readings WHERE id')) return { rows: [READING(opts.status ?? 'dispatch_failed', opts.snapshot ?? { birthData: { dob: '1990-01-01' }, verifiedFacts: { x: 1 } }, opts.reportType)] };
    return { rows: [] };
  });
  const store = require('@/lib/billing/reportPurchaseStore');
  store.getReportPurchaseByReadingId.mockResolvedValue(opts.purchase ?? { status: 'consumed', reportId: 'rid-1' });
  store.markReadingDispatchFailed.mockResolvedValue(undefined);
}

function call(readingId = 50) {
  return POST(
    new Request(`http://localhost/api/reports/${readingId}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    { params: Promise.resolve({ id: String(readingId) }) },
  );
}

describe('retry route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('launch gate — rejects a disabled SKU before claim or dispatch', async () => {
    setup({ reportType: 'transit' });
    const res = await call();
    expect(res.status).toBe(404);
    expect(claim).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
  });

  it('launch gate — Love Blueprint is now publicly retryable (post-LB-PUBLIC)', async () => {
    // After LB-PUBLIC: Love Blueprint is no longer gated by beta membership.
    // Any authenticated user with a consumed purchase can retry.
    setup({ reportType: 'loveblueprint', status: 'dispatch_failed' });
    const res = await call();
    expect(res.status).toBe(200);
    expect(claim).toHaveBeenCalled();
    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('r2 — rejects a queued reading (never re-dispatch active)', async () => {
    setup({ status: 'queued' });
    const res = await call();
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('r2 — rejects an approved reading', async () => {
    setup({ status: 'approved' });
    const res = await call();
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('r2 — rejects a quality-rejected (judge) reading: NOT customer-retryable', async () => {
    setup({ status: 'rejected', claimResult: true });
    const res = await call();
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('r2/r3 — claims dispatch_failed and dispatches once', async () => {
    setup({ status: 'dispatch_failed', claimResult: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(dispatched).toHaveBeenCalledTimes(1);
  });
  it('r3 — loser of concurrent claim gets 409 (no double dispatch)', async () => {
    setup({ status: 'dispatch_failed', claimResult: false });
    const res = await call();
    expect(res.status).toBe(409);
    expect(dispatched).not.toHaveBeenCalled();
  });
  it('r3 — restores dispatch_failed when retry dispatch itself fails', async () => {
    setup({ status: 'dispatch_failed', claimResult: true, dispatchResult: { ok: false, status: 502 } });
    const markFailed = require('@/lib/billing/reportPurchaseStore').markReadingDispatchFailed;
    const res = await call();
    expect(res.status).toBe(502);
    expect(markFailed).toHaveBeenCalledWith(50);
  });
  it('r4 — uses the stored snapshot, not a re-read chart', async () => {
    setup({ status: 'dispatch_failed', claimResult: true, snapshot: { birthData: { dob: '1990-01-01', firstName: 'Original' }, verifiedFacts: { snapshot: true } } });
    await call();
    expect(dispatched).toHaveBeenCalledTimes(1);
    const arg = dispatched.mock.calls[0][0];
    expect(arg.birthData.dob).toBe('1990-01-01');
    expect(arg.birthData.firstName).toBe('Original');
    expect(arg.verifiedFacts.snapshot).toBe(true);
  });
});
