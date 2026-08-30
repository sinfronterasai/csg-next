import {
  mapReportType, isUnsupportedForPipeline, PROMPT_SLUG,
  dispatchReport, sendEditorDecision, sendEditorAction, verifyCallbackToken, canTransition,
  hashReportSections, validateQualityRecoveryArtifact, qualityArtifactProvesPass,
  __setFetch,
} from '@/lib/reportPipeline';
import { isReportDeliverable } from '@/lib/profile/store';

// --- fake fetch capturing the last request ---
let lastReq: { url: string; headers: Record<string, string>; body: any } | null = null;
let nextRes = { ok: true, status: 200 } as { ok: boolean; status: number };

function fakeFetch(url: string, init: any) {
  lastReq = {
    url,
    headers: Object.fromEntries(Object.entries(init.headers || {})),
    body: JSON.parse(init.body),
  };
  return Promise.resolve({ ok: nextRes.ok, status: nextRes.status, json: async () => ({}) });
}

beforeEach(() => {
  __setFetch(fakeFetch as any);
  lastReq = null;
  nextRes = { ok: true, status: 200 };
  process.env.N8N_REPORT_WEBHOOK_URL = 'https://n8n.test/webhook/report-generate';
  process.env.N8N_EDITOR_WEBHOOK_URL = 'https://n8n.test/webhook/report-editor-decision';
  process.env.REPORT_PIPELINE_TOKEN = 'pipeline-token-123';
  process.env.REPORT_CALLBACK_TOKEN = 'callback-token-456';
  process.env.CSG_REPORT_CALLBACK_URL = 'https://app.test/api/reports/pipeline-complete';
});

describe('R1 type + prompt mapping', () => {
  it('maps every supported report type and prompt slug', () => {
    for (const t of ['natal','relationship','loveblueprint','lovetiming','yearlytransit','vocation','karmicshadow','fullcosmic'] as const) {
      expect(mapReportType(t)).toBe(t);
      expect(PROMPT_SLUG[t]).toBeTruthy();
    }
  });
  it('maps internal transit -> yearlytransit', () => {
    expect(mapReportType('transit')).toBe('yearlytransit');
  });
  it('rejects two-person and tarot from the pipeline', () => {
    for (const t of ['synastry','composite','couples','tarot']) {
      expect(isUnsupportedForPipeline(t)).toBe(true);
      expect(mapReportType(t)).toBeNull();
    }
  });
});

describe('R1 dispatcher payload', () => {
  it('sends exact contract payload with bearer and callback', async () => {
    const r = await dispatchReport({
      reportId: 'uuid-1', reportType: 'transit', tier: 'paid',
      birthData: { dob: '1990-06-15', birthTime: '12:00', place: 'Paris', lat: 48.8, lon: 2.3, tz: 'Europe/Paris', solarFallback: false },
      verifiedFacts: { x: 1 }, promptSlug: '',
    });
    expect(r.ok).toBe(true);
    expect(lastReq!.url).toBe('https://n8n.test/webhook/report-generate');
    expect(lastReq!.headers['Authorization']).toBe('Bearer pipeline-token-123');
    expect(lastReq!.body.reportType).toBe('yearlytransit');
    expect(lastReq!.body.tier).toBe('paid');
    expect(lastReq!.body.reportId).toBe('uuid-1');
    expect(lastReq!.body.callbackUrl).toBe('https://app.test/api/reports/pipeline-complete');
    expect(lastReq!.body.verifiedFacts).toEqual({ x: 1 });
  });

  it('missing pipeline config fails closed (throws, no request)', async () => {
    delete process.env.N8N_REPORT_WEBHOOK_URL;
    await expect(dispatchReport({
      reportId: 'u', reportType: 'natal', tier: 'free',
      birthData: { dob: '1990-06-15', birthTime: null, place: 'Paris', lat: 1, lon: 1, tz: 'UTC', solarFallback: true },
      verifiedFacts: {}, promptSlug: '',
    })).rejects.toThrow(/Missing required environment variable/);
    expect(lastReq).toBeNull();
  });

  it('missing callback token fails closed', () => {
    delete process.env.REPORT_CALLBACK_TOKEN;
    expect(verifyCallbackToken('anything')).toBe(false);
  });
});

describe('R1 unsupported types do not dispatch', () => {
  it('throws before any network call for synastry/composite/couples/tarot', async () => {
    for (const t of ['synastry','composite','couples','tarot']) {
      await expect(dispatchReport({
        reportId: 'u', reportType: t, tier: 'paid',
        birthData: { dob: '1990-06-15', birthTime: null, place: 'X', lat: 1, lon: 1, tz: 'UTC', solarFallback: false },
        verifiedFacts: {}, promptSlug: '',
      })).rejects.toThrow(/not dispatched|Unsupported/);
    }
    expect(lastReq).toBeNull();
  });
});

describe('R2 callback token', () => {
  it('rejects wrong callback token', () => {
    expect(verifyCallbackToken('wrong')).toBe(false);
  });
  it('accepts correct callback token', () => {
    expect(verifyCallbackToken('callback-token-456')).toBe(true);
  });
  it('rejects absent token', () => {
    expect(verifyCallbackToken(null)).toBe(false);
    expect(verifyCallbackToken(undefined)).toBe(false);
  });
});

describe('R3 editor decision payload', () => {
  it('sends decision with bearer to editor webhook', async () => {
    const r = await sendEditorDecision({ reportId: 'uuid-1', decision: 'approved', editorNote: 'ok', reviewer: 'editor-1' });
    expect(r.ok).toBe(true);
    expect(lastReq!.url).toBe('https://n8n.test/webhook/report-editor-decision');
    expect(lastReq!.headers['Authorization']).toBe('Bearer pipeline-token-123');
    expect(lastReq!.body.decision).toBe('approved');
    expect(lastReq!.body.reviewer).toBe('editor-1');
    expect(lastReq!.body.callbackUrl).toBe('https://app.test/api/reports/pipeline-complete');
  });
});

describe('R6.5 locked quality artifact and private editor payload', () => {
  const currentSections = [{ id: 'patterns', prose: 'Safe prose.', factsCited: ['fact.1'] }];
  const passing = (tier: 'free' | 'paid') => ({
    version: 1,
    candidateHash: hashReportSections(currentSections),
    attemptCount: 2,
    failedSections: [],
    issues: [],
    hardGates: { factual: true, banned: true, specific: true, dup: true, tone: true, structure: true, length: true, ageConsent: true },
    scores: { precision: tier === 'paid' ? 4 : 3, insightDensity: tier === 'paid' ? 4 : 3, voiceFit: tier === 'paid' ? 4 : 3, empowerment: tier === 'paid' ? 4 : 3, personalization: tier === 'paid' ? 4 : 3, clarity: tier === 'paid' ? 4 : 3, cohesion: tier === 'paid' ? 4 : 3, narrativeDepth: tier === 'paid' ? 4 : 3 },
    judgeSchemaValid: true,
    hardGatesPassed: true,
  });

  it('validates the exact V1 shape including narrativeDepth and rejects extra/malformed fields', () => {
    expect(validateQualityRecoveryArtifact(passing('free'))).not.toBeNull();
    expect(validateQualityRecoveryArtifact({ ...passing('free'), extra: true })).toBeNull();
    expect(validateQualityRecoveryArtifact({ ...passing('free'), scores: { ...passing('free').scores, narrativeDepth: 6 } })).toBeNull();
    const { narrativeDepth, ...oldScores } = passing('free').scores;
    expect(validateQualityRecoveryArtifact({ ...passing('free'), scores: oldScores })).toBeNull();
  });

  it('fails approval closed on gate, score, unresolved section, schema, or candidate hash mismatch', () => {
    expect(qualityArtifactProvesPass(passing('free'), 'free', currentSections)).toBe(true);
    expect(qualityArtifactProvesPass(passing('paid'), 'paid', currentSections)).toBe(true);
    expect(qualityArtifactProvesPass({ ...passing('free'), hardGatesPassed: false }, 'free', currentSections)).toBe(false);
    expect(qualityArtifactProvesPass({ ...passing('free'), scores: { ...passing('free').scores, narrativeDepth: 2 } }, 'free', currentSections)).toBe(false);
    expect(qualityArtifactProvesPass({ ...passing('free'), failedSections: ['patterns'] }, 'free', currentSections)).toBe(false);
    expect(qualityArtifactProvesPass({ ...passing('free'), judgeSchemaValid: false }, 'free', currentSections)).toBe(false);
    expect(qualityArtifactProvesPass({ ...passing('free'), candidateHash: 'c'.repeat(64) }, 'free', currentSections)).toBe(false);
  });

  it('sends bounded server-owned resubmit context and a deterministic idempotency key', async () => {
    const input: any = {
      reportId: 'uuid-r65', reportType: 'natal', tier: 'free', action: 'resubmit', reviewer: 'editor@example.test',
      editorNote: 'fixed', currentSections,
      correctedSections: [{ id: 'patterns', prose: 'Corrected.', factsCited: ['fact.1'] }],
      regenerateSectionIds: [], qualityArtifact: passing('free'), verifiedFacts: { private: true },
    };
    await sendEditorAction(input);
    const first = lastReq!.body;
    await sendEditorAction(input);
    const second = lastReq!.body;
    expect(first).toMatchObject({ reportId: 'uuid-r65', reportType: 'natal', tier: 'free', action: 'resubmit', verifiedFacts: { private: true } });
    expect(first.callbackUrl).toBe('https://app.test/api/reports/pipeline-complete');
    expect(first.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(lastReq!.headers.Authorization).toBe('Bearer pipeline-token-123');
  });
});

describe('state machine', () => {
  it('allows processing/queued -> approved', () => {
    expect(canTransition(null, 'approved')).toBe(true);
    expect(canTransition('queued', 'processing')).toBe(true);
    expect(canTransition('processing', 'needs_editor')).toBe(true);
  });
  it('paid needs_editor -> approved or rejected (no regress to needs_editor)', () => {
    expect(canTransition('needs_editor', 'approved')).toBe(true);
    expect(canTransition('needs_editor', 'rejected')).toBe(true);
    expect(canTransition('needs_editor', 'needs_editor')).toBe(false);
  });
  it('terminal states never regress', () => {
    expect(canTransition('approved', 'rejected')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(canTransition('approved', 'approved')).toBe(true);
    expect(canTransition('rejected', 'rejected')).toBe(true);
  });
  it('free approved never moves to needs_editor', () => {
    expect(canTransition('approved', 'needs_editor')).toBe(false);
  });
});

describe('delivery gate (paid needs_editor cannot be delivered)', () => {
  const base = { id: 1, type: 'report', result: {} as any, pipelineStatus: null } as any;
  it('blocks needs_editor', () => {
    const rec = { ...base, result: { pipeline: { status: 'needs_editor' } } };
    expect(isReportDeliverable(rec)).toBe(false);
  });
  it('blocks rejected', () => {
    const rec = { ...base, result: { pipeline: { status: 'rejected' } } };
    expect(isReportDeliverable(rec)).toBe(false);
  });
  it('allows approved', () => {
    const rec = { ...base, result: { pipeline: { status: 'approved' } } };
    expect(isReportDeliverable(rec)).toBe(true);
  });
});
