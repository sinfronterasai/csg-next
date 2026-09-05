// R6.5 private editor action route: authorization, validation, and escalation.
import { PATCH } from '@/app/api/reports/[id]/editor-decision/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
let currentRole = 'editor';
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: 'editor-1' }),
  getUserById: async () => ({ id: 'editor-1', email: 'editor@example.test', role: currentRole }),
}));

let getReportByIdForRole: jest.Mock;
let claimEditorAction: jest.Mock;
let releaseEditorActionClaim: jest.Mock;
let sendEditorAction: jest.Mock;

jest.mock('@/lib/profile/store', () => ({
  getReportByIdForRole: (...a: any[]) => getReportByIdForRole(...a),
  claimEditorAction: (...a: any[]) => claimEditorAction(...a),
  releaseEditorActionClaim: (...a: any[]) => releaseEditorActionClaim(...a),
}));
jest.mock('@/lib/reportPipeline', () => {
  const actual = jest.requireActual('@/lib/reportPipeline');
  return { ...actual, sendEditorAction: (...a: any[]) => sendEditorAction(...a) };
});

const sections = [
  { id: 'identity', prose: 'Safe identity prose.', factsCited: ['fact.sun'] },
  { id: 'patterns', prose: 'Safe patterns prose.', factsCited: ['fact.moon'] },
];

function quality(over: any = {}) {
  return {
    version: 1,
    candidateHash: 'a'.repeat(64),
    attemptCount: 2,
    failedSections: ['patterns'],
    issues: [{ section: 'patterns', category: 'specificity', repairable: true, problem: 'Too generic.', requiredFix: 'Be concrete.', factIds: ['fact.moon'] }],
    hardGates: { factual: false, banned: true, specific: true, dup: true, tone: true, structure: true, length: true, ageConsent: true },
    scores: { precision: 3, insightDensity: 3, voiceFit: 3, empowerment: 3, personalization: 3, clarity: 3, cohesion: 3, narrativeDepth: 3 },
    hardGatesPassed: false,
    judgeSchemaValid: true,
    ...over,
  };
}

function makeRec(over: any = {}) {
  const base: any = {
    id: 5, type: 'report', userId: 999,
    result: {
      reportId: 'rid-z', reportType: 'natal', tier: 'free',
      metadata: { birthData: { dob: '1990-01-01' }, verifiedFacts: { private: 'authoritative' } },
      pipeline: { status: 'needs_editor', sections, qualityArtifact: quality(), judge: { verdict: 'revise' } },
    },
    pipelineStatus: 'needs_editor',
  };
  return { ...base, ...over };
}

function call(id: string, body: any, raw?: string) {
  const text = raw ?? JSON.stringify(body);
  return PATCH(
    new Request(`http://localhost/api/reports/${id}/editor-decision`, {
      method: 'PATCH', headers: { 'content-length': String(text.length) }, body: text,
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  currentRole = 'editor';
  getReportByIdForRole = jest.fn();
  claimEditorAction = jest.fn(async () => 'claimed');
  releaseEditorActionClaim = jest.fn(async () => {});
  sendEditorAction = jest.fn(async () => ({ ok: true, status: 202 }));
});

describe('R6.5 editor action route', () => {
  it('allows a free Natal failed section correction and forwards server-owned private context', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    const res = await call('5', {
      action: 'resubmit', editorNote: 'Corrected specificity.',
      correctedSections: [{ id: 'patterns', prose: 'Corrected safe prose.', factsCited: ['fact.moon'] }],
      reportId: 'attacker-id', verifiedFacts: { attacker: true }, callbackUrl: 'https://attacker.test',
    });
    expect(res.status).toBe(202);
    const sent = sendEditorAction.mock.calls[0][0];
    expect(sent).toMatchObject({ reportId: 'rid-z', reportType: 'natal', tier: 'free', action: 'resubmit' });
    expect(sent.verifiedFacts).toEqual({ private: 'authoritative' });
    expect(sent.currentSections).toEqual(sections);
    expect(sent.correctedSections).toHaveLength(1);
    expect(sent.callbackUrl).toBeUndefined();
    expect(JSON.stringify(await res.json())).not.toContain('authoritative');
  });

  it('allows paid Love Blueprint approval only after explicit editor action and a validated stored pass', async () => {
    const { hashReportSections } = jest.requireActual('@/lib/reportPipeline');
    const passing = quality({
      candidateHash: hashReportSections(sections), failedSections: [], issues: [],
      hardGates: { factual: true, banned: true, specific: true, dup: true, tone: true, structure: true, length: true, ageConsent: true },
      scores: { precision: 4, insightDensity: 4, voiceFit: 4, empowerment: 4, personalization: 4, clarity: 4, cohesion: 4, narrativeDepth: 4 },
      hardGatesPassed: true, judgeSchemaValid: true,
    });
    getReportByIdForRole.mockResolvedValue(makeRec({
      result: {
        ...makeRec().result, reportType: 'loveblueprint', tier: 'paid',
        pipeline: { status: 'needs_editor', sections, qualityArtifact: passing, judge: { verdict: 'pass' } },
      },
    }));
    const res = await call('5', { action: 'approve', editorNote: 'Signed off.' });
    expect(res.status).toBe(202);
    expect(sendEditorAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', tier: 'paid' }));
  });

  it('blocks approval when a stored hard gate fails', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    const res = await call('5', { action: 'approve' });
    expect(res.status).toBe(409);
    expect(sendEditorAction).not.toHaveBeenCalled();
  });

  it('rejects corrected unknown, duplicate, and empty section IDs', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    for (const correctedSections of [
      [{ id: 'unknown', prose: 'x' }],
      [{ id: 'patterns', prose: 'x' }, { id: 'patterns', prose: 'y' }],
      [{ id: '', prose: 'x' }],
    ]) {
      const res = await call('5', { action: 'resubmit', correctedSections });
      expect(res.status).toBe(400);
    }
    expect(sendEditorAction).not.toHaveBeenCalled();
  });

  it('requires corrected sections to exactly cover every failed section', async () => {
    const twoFailures = quality({
      failedSections: ['identity', 'patterns'],
      issues: [
        { section: 'identity', category: 'factual', repairable: true, problem: 'Mismatch.', requiredFix: 'Correct it.', factIds: ['fact.sun'] },
        { section: 'patterns', category: 'specificity', repairable: true, problem: 'Too generic.', requiredFix: 'Be concrete.', factIds: ['fact.moon'] },
      ],
    });
    getReportByIdForRole.mockResolvedValue(makeRec({
      result: { ...makeRec().result, pipeline: { status: 'needs_editor', sections, qualityArtifact: twoFailures, judge: { verdict: 'revise' } } },
    }));
    const partial = await call('5', {
      action: 'resubmit',
      correctedSections: [{ id: 'patterns', prose: 'Only one repair.', factsCited: ['fact.moon'] }],
    });
    expect(partial.status).toBe(400);
    expect(sendEditorAction).not.toHaveBeenCalled();
  });

  it('allows regeneration only for failed repairable section IDs', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    expect((await call('5', { action: 'regenerate', regenerateSectionIds: ['patterns'] })).status).toBe(202);
    expect(sendEditorAction).toHaveBeenCalledWith(expect.objectContaining({ regenerateSectionIds: ['patterns'] }));
    sendEditorAction.mockClear();
    expect((await call('5', { action: 'regenerate', regenerateSectionIds: ['identity'] })).status).toBe(400);
    expect(sendEditorAction).not.toHaveBeenCalled();
  });

  it('requires an internal reason for reject', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    expect((await call('5', { action: 'reject' })).status).toBe(400);
    expect((await call('5', { action: 'reject', editorNote: 'Hold: factual review required.' })).status).toBe(202);
  });

  it('supports the legacy accept spelling as approve without weakening pass checks', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    expect((await call('5', { action: 'accept' })).status).toBe(409);
  });

  it('rejects unauthorized, out-of-scope, malformed, and wrong-state requests', async () => {
    currentRole = 'customer';
    expect((await call('5', { action: 'resubmit', correctedSections: [{ id: 'patterns', prose: 'x' }] })).status).toBe(403);
    currentRole = 'editor';
    getReportByIdForRole.mockResolvedValue(makeRec({ pipelineStatus: 'approved' }));
    expect((await call('5', { action: 'reject', editorNote: 'reason' })).status).toBe(409);
    getReportByIdForRole.mockResolvedValue(makeRec({ result: { ...makeRec().result, reportType: 'fullcosmic', tier: 'paid' } }));
    expect((await call('5', { action: 'reject', editorNote: 'reason' })).status).toBe(400);
    expect((await call('5', {}, '{bad')).status).toBe(400);
    expect((await call('not-a-number', { action: 'reject', editorNote: 'reason' })).status).toBe(400);
  });

  it('returns idempotent duplicate and conflicting in-flight outcomes without redispatch', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    claimEditorAction.mockResolvedValueOnce('duplicate');
    const dup = await call('5', { action: 'reject', editorNote: 'same reason' });
    expect(dup.status).toBe(202);
    expect((await dup.json()).duplicate).toBe(true);
    claimEditorAction.mockResolvedValueOnce('conflict');
    expect((await call('5', { action: 'reject', editorNote: 'other reason' })).status).toBe(409);
    expect(sendEditorAction).not.toHaveBeenCalled();
  });

  it('releases the in-flight claim when n8n dispatch fails', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    sendEditorAction.mockResolvedValue({ ok: false, status: 500 });
    expect((await call('5', { action: 'reject', editorNote: 'reason' })).status).toBe(502);
    expect(releaseEditorActionClaim).toHaveBeenCalledTimes(1);
  });
});
