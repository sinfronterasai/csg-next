// Route-level tests for POST /api/reports/pipeline-complete. We mock the store
// and the token verifier so we exercise the full handler (validation, body
// checks, outcome mapping) without a database.
import { POST } from '@/app/api/reports/pipeline-complete/route';

const VALID_REPORT = {
  id: 1, type: 'report', result: { reportId: 'rid-x', pipeline: { status: 'queued' } },
  pipelineStatus: 'queued', pipelineCallbackHash: null,
};

jest.mock('@/lib/reportPipeline', () => ({
  verifyCallbackToken: (t: string | null) => t === 'good-token',
}));

let getReadingByReportId: jest.Mock;
let applyPipelineCallback: jest.Mock;

jest.mock('@/lib/profile/store', () => ({
  getReadingByReportId: (...args: any[]) => getReadingByReportId(...args),
  applyPipelineCallback: (...args: any[]) => applyPipelineCallback(...args),
  // Deterministic stand-in so route tests don't depend on crypto.
  canonicalCallbackHash: (p: any) => 'h:' + JSON.stringify({ s: p.status, n: (p.sections||[]).length, j: !!p.judge }),
}));

function call(body: any, token = 'good-token') {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('content-length', String(JSON.stringify(body).length));
  return POST(new Request('http://localhost/api/reports/pipeline-complete', {
    method: 'POST', headers, body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  getReadingByReportId = jest.fn();
  applyPipelineCallback = jest.fn();
});

describe('R2.1 auth', () => {
  it('rejects missing token with 401', async () => {
    const res = await call({ reportId: 'r', status: 'approved', sections: [{ id: 's' }], judge: {} }, null);
    expect(res.status).toBe(401);
  });
  it('rejects wrong token with 401', async () => {
    const res = await call({ reportId: 'r', status: 'approved', sections: [{ id: 's' }], judge: {} }, 'bad');
    expect(res.status).toBe(401);
  });
});

describe('R2.2 validation', () => {
  it('unknown reportId -> 404', async () => {
    getReadingByReportId.mockResolvedValue(null);
    const res = await call({ reportId: 'r', status: 'approved', sections: [{ id: 's' }], judge: {} });
    expect(res.status).toBe(404);
  });
  it('malformed JSON -> 400', async () => {
    const headers = new Headers();
    headers.set('authorization', 'Bearer good-token');
    const res = await POST(new Request('http://localhost/x', { method: 'POST', headers, body: 'not json' }));
    expect(res.status).toBe(400);
  });
  it('missing status -> 400', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', sections: [{ id: 's' }], judge: {} });
    expect(res.status).toBe(400);
  });
  it('invalid section shape -> 400', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [{ prose: 123 }], judge: {} });
    expect(res.status).toBe(400);
  });
  it('approved requires sections + judge -> 400', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [], judge: {} });
    expect(res.status).toBe(400);
  });
  it('rejected requires rejectReasons -> 400', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'rejected' });
    expect(res.status).toBe(400);
  });
});

describe('R2.4/R4 outcome mapping', () => {
  const body = { reportId: 'rid-x', status: 'approved', sections: [{ id: 's' }], judge: { ok: true } };

  it('applied -> 200', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('applied');
    const res = await call(body);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.duplicate).toBeUndefined();
  });
  it('duplicate -> 200 with duplicate flag', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('duplicate');
    const res = await call(body);
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });
  it('conflict -> 409', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('conflict');
    const res = await call(body);
    expect(res.status).toBe(409);
  });
  it('regression -> 409', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('regression');
    const res = await call(body);
    expect(res.status).toBe(409);
  });
});
