// Focused route test for the free-report path. Catches the dispatch-regression bug
// (#1: free INSERT RETURNING id then reading result was undefined -> empty birthData/
// verifiedFacts) and confirms callback correlation (reportId in result === reportId
// dispatched === reportId returned to the client).
import { POST } from '@/app/api/reports/generate/route';

jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }) }));
jest.mock('@/lib/auth', () => ({ verifyToken: () => ({ userId: '7' }), getUserById: async () => ({ id: 7, first_name: 'Tester', email: 'a@x.com', role: 'customer' }) }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

const CHART = {
  birth_date: new Date('1990-05-01'), birth_time: new Date('1990-05-01T10:30:00'),
  location_name: 'Paris', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris', unknown_time: false,
};
const VERIFIED = { sunSign: 'Taurus', moonSign: 'Leo', ascendant: 'Cancer' };

jest.mock('@/lib/reportVerifiedFacts', () => ({ extractVerifiedFacts: async () => VERIFIED }));
jest.mock('@/lib/reportEngine', () => ({ REPORT_META: { natal: { price: 0, title: 'Natal Chart' } }, __esModule: true }));
jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => t,
  isUnsupportedForPipeline: (t: string) => t === 'synastry' || t === 'composite' || t === 'couples',
  dispatchReport: (...a: any[]) => dispatched(...a),
}));

let dispatched: jest.Mock;
let query: jest.Mock;

const readings: any[] = [];

function setup() {
  dispatched = jest.fn(async () => ({ ok: true, status: 200 }));
  query = require('@/lib/db').query;
  query.mockImplementation(async (text: string, params?: any[]) => {
    if (text.includes('FROM natal_charts')) return { rows: [CHART] };
    if (text.startsWith('INSERT INTO readings')) {
      const result = JSON.parse(params![4]);
      const row = { id: readings.length + 1, user_id: params![0], type: 'report', result, pipeline_status: 'queued' };
      readings.push(row);
      // #1 regression guard: the route must construct result ONCE and reuse it, so the
      // INSERT's result matches what dispatch receives. RETURNING id, result proves it.
      return { rows: [{ id: row.id, result: params![4] }], rowCount: 1 };
    }
    if (text.includes("SET pipeline_status")) {
      const r = readings.find((x) => x.id === Number(params![0]));
      if (r) r.pipeline_status = String(params![1]).replace(/'/g, '');
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
}

function call() {
  return POST(new Request('http://localhost/api/reports/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'natal' }) }));
}

describe('free report dispatch', () => {
  beforeEach(() => { jest.clearAllMocks(); readings.length = 0; setup(); });

  it('#1 — free Natal dispatches with NONEMPTY birthData + verifiedFacts and exact reportId', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(dispatched).toHaveBeenCalledTimes(1);

    const arg = dispatched.mock.calls[0][0];
    // birthData must be nonempty (chart-derived), not undefined/empty.
    expect(arg.birthData).toBeTruthy();
    expect(arg.birthData.dob).toBe('1990-05-01');
    expect(arg.birthData.place).toBe('Paris');
    // verifiedFacts must be the real facts, not empty.
    expect(arg.verifiedFacts).toEqual(VERIFIED);
    // reportId must be identical across dispatch, the returned body, and the stored row.
    expect(arg.reportId).toBe(body.reportId);
    expect(readings[0].result.reportId).toBe(body.reportId);
  });

  it('#1 — dispatch does NOT receive undefined birthData/verifiedFacts (regression guard)', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const arg = dispatched.mock.calls[0][0];
    expect(arg.birthData).not.toBeUndefined();
    expect(arg.verifiedFacts).not.toBeUndefined();
    expect(Object.keys(arg.verifiedFacts)).not.toHaveLength(0);
  });

  it('#1 — stored reading result.reportId equals the dispatched reportId (callback correlation)', async () => {
    const res = await call();
    const body = await res.json();
    // Simulate the callback lookup the pipeline-complete route performs:
    //   SELECT ... FROM readings WHERE result->>'reportId' = $1
    const correlated = readings.find((r) => r.result.reportId === body.reportId);
    expect(correlated).toBeDefined();
    expect(correlated.id).toBe(body.readingId);
  });
});
