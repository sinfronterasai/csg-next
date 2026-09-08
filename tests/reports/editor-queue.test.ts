import { GET } from '@/app/api/reports/editor-queue/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
let role = 'editor';
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: 'staff-1' }),
  getUserById: async () => ({ id: 'staff-1', role }),
}));
let listEditorQueueReports: jest.Mock;
jest.mock('@/lib/profile/store', () => {
  const actual = jest.requireActual('@/lib/profile/store');
  return { ...actual, listEditorQueueReports: (...a: any[]) => listEditorQueueReports(...a) };
});

const artifact = {
  version: 1,
  candidateHash: 'b'.repeat(64),
  attemptCount: 2,
  failedSections: ['patterns'],
  issues: [{ section: 'patterns', category: 'narrative', repairable: true, problem: 'Thin synthesis.', requiredFix: 'Deepen synthesis.', factIds: ['fact.safe'] }],
  hardGates: { factual: true, banned: true, specific: true, dup: true, tone: true, structure: true, length: true, ageConsent: true },
  scores: { precision: 3, insightDensity: 3, voiceFit: 3, empowerment: 3, personalization: 3, clarity: 3, cohesion: 3, narrativeDepth: 2 },
  judgeSchemaValid: true,
  hardGatesPassed: true,
};

beforeEach(() => {
  role = 'editor';
  listEditorQueueReports = jest.fn(async () => [{
    id: 9, type: 'report', pipelineStatus: 'needs_editor', createdAt: '2026-08-30T00:00:00Z',
    result: {
      reportId: 'rid-private', reportType: 'natal', tier: 'free',
      verifiedFacts: { secretLedger: 'NEVER-PUBLIC' },
      metadata: { birthData: { dob: 'PRIVATE-BIRTH' }, verifiedFacts: { secretLedger: 'NEVER-PUBLIC' } },
      rawPrompt: 'PRIVATE-PROMPT', callbackToken: 'PRIVATE-TOKEN',
      pipeline: {
        status: 'needs_editor',
        sections: [{ id: 'patterns', prose: 'Safe draft prose.', factsCited: ['fact.safe'], rawPrompt: 'DROP-ME' }],
        qualityArtifact: artifact,
        judge: { notes: 'PRIVATE-JUDGE-NOTES' },
        editorNote: 'PRIVATE-STAFF-NOTE',
      },
    },
  }]);
});

describe('R6.5 private editor queue', () => {
  it.each(['editor', 'admin'])('allows %s and returns only the locked sanitized artifact/safe draft shape', async (staffRole) => {
    role = staffRole;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(listEditorQueueReports).toHaveBeenCalledTimes(1);
    expect(body.reports).toEqual([{
      readingId: 9,
      reportId: 'rid-private',
      reportType: 'natal',
      tier: 'free',
      status: 'needs_editor',
      createdAt: '2026-08-30T00:00:00Z',
      safeDraftSections: [{ id: 'patterns', prose: 'Safe draft prose.', factsCited: ['fact.safe'] }],
      qualityArtifact: artifact,
    }]);
    const json = JSON.stringify(body);
    for (const secret of ['PRIVATE-BIRTH', 'NEVER-PUBLIC', 'PRIVATE-PROMPT', 'PRIVATE-TOKEN', 'PRIVATE-JUDGE-NOTES', 'PRIVATE-STAFF-NOTE', 'rawPrompt', 'callbackToken']) {
      expect(json).not.toContain(secret);
    }
  });

  it('returns 403 to customer/owner roles without querying queue data', async () => {
    role = 'customer';
    const res = await GET();
    expect(res.status).toBe(403);
    expect(listEditorQueueReports).not.toHaveBeenCalled();
  });

  it('drops malformed artifacts and non-MVP rows fail closed', async () => {
    listEditorQueueReports.mockResolvedValue([
      { id: 1, type: 'report', pipelineStatus: 'needs_editor', result: { reportId: 'x', reportType: 'fullcosmic', tier: 'paid', pipeline: { sections: [], qualityArtifact: artifact } } },
      { id: 2, type: 'report', pipelineStatus: 'needs_editor', result: { reportId: 'y', reportType: 'natal', tier: 'free', pipeline: { sections: [], qualityArtifact: { ...artifact, scores: { ...artifact.scores, narrativeDepth: 99 } } } } },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).reports).toEqual([]);
  });
});
