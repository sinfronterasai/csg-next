// Route-level tests for POST /api/reports/pipeline-complete. We mock the store
// and the token verifier so we exercise the full handler (validation, body
// checks, outcome mapping) without a database.
import { POST } from '@/app/api/reports/pipeline-complete/route';
import { hashReportSections } from '@/lib/reportPipeline';

const VALID_SECTIONS = [{ id: 's', prose: 'Safe report prose.', factsCited: ['fact.safe'] }];
function qualityArtifact(tier: 'free' | 'paid' = 'free', over: any = {}) {
  const score = tier === 'paid' ? 4 : 3;
  return {
    version: 1, candidateHash: hashReportSections(VALID_SECTIONS), attemptCount: 2,
    failedSections: [], issues: [],
    hardGates: { factual: true, banned: true, specific: true, dup: true, tone: true, structure: true, length: true, ageConsent: true },
    scores: { precision: score, insightDensity: score, voiceFit: score, empowerment: score, personalization: score, clarity: score, cohesion: score, narrativeDepth: score },
    judgeSchemaValid: true, hardGatesPassed: true, ...over,
  };
}
function validBody(over: any = {}) {
  return { reportId: 'rid-x', status: 'approved', sections: VALID_SECTIONS, judge: { verdict: 'pass' }, qualityArtifact: qualityArtifact(), ...over };
}

const VALID_REPORT = {
  id: 1, type: 'report', result: { reportId: 'rid-x', reportType: 'natal', tier: 'free', pipeline: { status: 'queued' } },
  pipelineStatus: 'queued', pipelineCallbackHash: null,
};

jest.mock('@/lib/reportPipeline', () => {
  const actual = jest.requireActual('@/lib/reportPipeline');
  return { ...actual, verifyCallbackToken: (t: string | null) => t === 'good-token' };
});

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

  it('approved/needs_editor require a locked artifact matching the candidate sections', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    expect((await call(validBody({ qualityArtifact: undefined }))).status).toBe(400);
    expect((await call(validBody({ qualityArtifact: { ...qualityArtifact(), candidateHash: 'c'.repeat(64) } }))).status).toBe(400);
  });

  it('preserves legacy non-R6.5 callbacks without requiring the new artifact', async () => {
    getReadingByReportId.mockResolvedValue({
      ...VALID_REPORT,
      result: { ...VALID_REPORT.result, reportType: 'relationship', tier: 'free' },
    });
    applyPipelineCallback.mockResolvedValue('applied');
    const res = await call({
      reportId: 'rid-x', status: 'approved', sections: VALID_SECTIONS,
      judge: { verdict: 'pass' },
    });
    expect(res.status).toBe(200);
    expect(applyPipelineCallback).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed editor idempotency keys', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    expect((await call(validBody({ idempotencyKey: 'not-a-sha256' }))).status).toBe(400);
    expect(applyPipelineCallback).not.toHaveBeenCalled();
  });

  it('blocks a paid Love Blueprint direct approval before mandatory editor sign-off', async () => {
    getReadingByReportId.mockResolvedValue({
      ...VALID_REPORT, pipelineStatus: 'processing',
      result: { ...VALID_REPORT.result, reportType: 'loveblueprint', tier: 'paid', pipeline: { status: 'processing' } },
    });
    const res = await call(validBody({ qualityArtifact: qualityArtifact('paid') }));
    expect(res.status).toBe(409);
    expect(applyPipelineCallback).not.toHaveBeenCalled();
  });
});

describe('R2.4/R4 outcome mapping', () => {
  const body = validBody();

  it('applied -> 200', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('applied');
    const res = await call(body);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.duplicate).toBeUndefined();
  });
  it('forwards the exact editor action idempotency key to the atomic store transition', async () => {
    getReadingByReportId.mockResolvedValue(VALID_REPORT);
    applyPipelineCallback.mockResolvedValue('applied');
    const key = 'd'.repeat(64);
    expect((await call(validBody({ idempotencyKey: key }))).status).toBe(200);
    expect(applyPipelineCallback).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key }));
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
