// Route-level tests for POST /api/reports/pipeline-complete. We mock the store
// and the token verifier so we exercise the full handler (validation, body
// checks, outcome mapping) without a database.
import { POST } from '@/app/api/reports/pipeline-complete/route';

const VALID_REPORT = {
  id: 1, type: 'report', result: { reportId: 'rid-x', pipeline: { status: 'queued' } },
  pipelineStatus: 'queued', pipelineCallbackHash: null,
};

const VALID_SECTION = {
  id: 'core.identity',
  blocks: [
    { role: 'evidence', prose: 'Your Sun is in Aries.', factIds: ['common.sun.sign'] },
    { role: 'agency', prose: 'Choose where to direct that vitality.', factIds: ['common.sun.sign'] },
  ],
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
    const res = await call({ reportId: 'r', status: 'approved', sections: [VALID_SECTION], judge: {} }, null);
    expect(res.status).toBe(401);
  });
  it('rejects wrong token with 401', async () => {
    const res = await call({ reportId: 'r', status: 'approved', sections: [VALID_SECTION], judge: {} }, 'bad');
    expect(res.status).toBe(401);
  });
});

describe('R2.2 validation', () => {
  it('unknown reportId -> 404', async () => {
    getReadingByReportId.mockResolvedValue(null);
    const res = await call({ reportId: 'r', status: 'approved', sections: [VALID_SECTION], judge: {} });
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
    const res = await call({ reportId: 'rid-x', sections: [VALID_SECTION], judge: {} });
    expect(res.status).toBe(400);
  });
  it('does not create a standing human-review gate from pipeline callbacks', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'needs_editor', sections: [VALID_SECTION], judge: {} });
    expect(res.status).toBe(400);
    expect(applyPipelineCallback).not.toHaveBeenCalled();
  });
  it('invalid section shape -> 400', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [{ prose: 123 }], judge: {} });
    expect(res.status).toBe(400);
  });

  it.each([
    [{ ...VALID_SECTION, id: '   ' }],
    [{ ...VALID_SECTION, extra: 'not-in-contract' }],
    [{ id: 'core.identity', blocks: [{ role: 'evidence', prose: '   ', factIds: ['common.sun.sign'] }] }],
    [{ id: 'core.identity', blocks: [{ role: 'unknown', prose: 'Text', factIds: ['common.sun.sign'] }] }],
    [{ id: 'core.identity', blocks: [{ role: 'evidence', prose: 'Text', factIds: [''] }] }],
    [{ id: 'core.identity', blocks: [{ role: 'evidence', prose: 'Text', factIds: [] }] }],
    [{ id: 'core.identity', blocks: [{ role: 'evidence', prose: 'Text', factIds: [], extra: true }] }],
  ].map((sections) => [sections]))('rejects malformed exact block schema %#', async (sections) => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'approved', sections, judge: {} });
    expect(res.status).toBe(400);
    expect(applyPipelineCallback).not.toHaveBeenCalled();
  });

  it('rejects duplicate section ids', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [VALID_SECTION, VALID_SECTION], judge: {} });
    expect(res.status).toBe(400);
    expect(applyPipelineCallback).not.toHaveBeenCalled();
  });

  it('normalizes structured blocks to stored prose while retaining exact blocks', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('applied');
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [VALID_SECTION], judge: { pass: true } });
    expect(res.status).toBe(200);
    const input = applyPipelineCallback.mock.calls[0][0];
    expect(input.pipelineValue.sections).toEqual([{
      id: 'core.identity',
      prose: 'Your Sun is in Aries.\n\nChoose where to direct that vitality.',
      blocks: VALID_SECTION.blocks,
    }]);
  });
  it('accepts a null automated editorNote without exposing an editor workflow', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('applied');
    const res = await call({ reportId: 'rid-x', status: 'approved', sections: [VALID_SECTION], judge: {}, editorNote: null });
    expect(res.status).toBe(200);
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
  const body = { reportId: 'rid-x', status: 'approved', sections: [VALID_SECTION], judge: { ok: true } };

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
