import { applyPipelineCallback, canonicalCallbackHash, claimEditorAction, toPublicReport } from '@/lib/profile/store';

// In-memory fake of the `readings` table + transaction helper used by store.ts.
// Supports exactly the two statements applyPipelineCallback issues.
interface Row {
  id: number;
  type: string;
  result: any;
  pipeline_status: string | null;
  pipeline_callback_hash: string | null;
  pipeline_editor_action_hash: string | null;
  pipeline_editor_idempotency_key: string | null;
}

let table: Row[] = [];
let nextId = 1;

function reset() {
  table = [];
  nextId = 1;
}

function makeRow(reportId: string, pipelineStatus: string | null, pipeline?: any, hash?: string | null): Row {
  return {
    id: nextId++,
    type: 'report',
    result: { reportId, ...(pipeline ? { pipeline } : {}) },
    pipeline_status: pipelineStatus,
    pipeline_callback_hash: hash ?? null,
    pipeline_editor_action_hash: null,
    pipeline_editor_idempotency_key: null,
  };
}

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  transaction: async (fn: any) => {
    const txQuery = async (text: string, params?: any[]) => {
      // Lock select (FOR UPDATE)
      if (text.includes('FOR UPDATE')) {
        const key = params![0];
        const found = text.includes('WHERE id =')
          ? table.find((r) => r.id === key && r.type === 'report')
          : table.find((r) => r.type === 'report' && r.result.reportId === key);
        return { rows: found ? [{
          id: found.id,
          pipeline_status: found.pipeline_status,
          pipeline_callback_hash: found.pipeline_callback_hash,
          pipeline_editor_action_hash: found.pipeline_editor_action_hash,
          pipeline_editor_idempotency_key: found.pipeline_editor_idempotency_key,
        }] : [] };
      }
      // Editor action claim update.
      if (text.startsWith('UPDATE readings') && text.includes('pipeline_editor_action_hash = $2')) {
        const row = table.find((r) => r.id === params![0]);
        if (row) {
          row.pipeline_editor_action_hash = params![1];
          row.pipeline_editor_idempotency_key = params![2];
        }
        return { rows: row ? [row] : [] };
      }
      // Pipeline callback update.
      if (text.startsWith('UPDATE readings')) {
        const id = params![0];
        const pipelineValue = JSON.parse(params![1]);
        const status = params![2];
        const hash = params![3];
        const row = table.find((r) => r.id === id);
        if (row) {
          row.result = { ...row.result, pipeline: pipelineValue };
          row.pipeline_status = status;
          row.pipeline_callback_hash = hash;
          row.pipeline_editor_action_hash = null;
          row.pipeline_editor_idempotency_key = null;
        }
        return { rows: [row] };
      }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    };
    return fn(txQuery);
  },
}));

function makeCallback(status: string, sections: any[] = [], judge: any = { ok: true }, rejectReasons: string[] = []) {
  const payload = { status, sections, judge, editorNote: null, rejectReasons };
  return { payload, hash: canonicalCallbackHash(payload) };
}

describe('canonicalCallbackHash', () => {
  it('is stable for identical payloads', () => {
    const a = canonicalCallbackHash({ status: 'approved', sections: [{ id: 's1', prose: 'x' }], judge: { ok: true }, editorNote: null, rejectReasons: [] });
    const b = canonicalCallbackHash({ status: 'approved', sections: [{ id: 's1', prose: 'x' }], judge: { ok: true }, editorNote: null, rejectReasons: [] });
    expect(a).toBe(b);
  });
  it('differs when sections differ', () => {
    const a = canonicalCallbackHash({ status: 'approved', sections: [{ id: 's1' }], judge: null, editorNote: null, rejectReasons: [] });
    const b = canonicalCallbackHash({ status: 'approved', sections: [{ id: 's2' }], judge: null, editorNote: null, rejectReasons: [] });
    expect(a).not.toBe(b);
  });
});

describe('R6.5 editor action claims', () => {
  it('claims once, treats identical as duplicate, and conflicts with a different in-flight action', async () => {
    reset();
    const row = makeRow('rid-claim', 'needs_editor', { status: 'needs_editor' }, 'old-callback');
    table.push(row);
    expect(await claimEditorAction(row.id, 'action-a', 'idem-a')).toBe('claimed');
    expect(row.pipeline_editor_action_hash).toBe('action-a');
    expect(await claimEditorAction(row.id, 'action-a', 'idem-a')).toBe('duplicate');
    expect(await claimEditorAction(row.id, 'action-b', 'idem-b')).toBe('conflict');
  });

  it('allows a changed needs_editor callback only for a pending editor action and clears the claim', async () => {
    reset();
    const row = makeRow('rid-resubmit', 'needs_editor', { status: 'needs_editor', sections: [{ id: 'old' }] }, 'old-hash');
    row.pipeline_editor_action_hash = 'action-a';
    row.pipeline_editor_idempotency_key = 'idem-a';
    table.push(row);
    const { payload, hash } = makeCallback('needs_editor', [{ id: 'new' }]);
    const outcome = await applyPipelineCallback({
      reportId: 'rid-resubmit', status: 'needs_editor',
      pipelineValue: { status: 'needs_editor', sections: payload.sections },
      callbackHash: hash, idempotencyKey: 'idem-a',
    });
    expect(outcome).toBe('applied');
    expect(row.pipeline_editor_action_hash).toBeNull();
    expect(row.pipeline_editor_idempotency_key).toBeNull();
  });

  it('rejects missing or mismatched claim keys and preserves the in-flight claim', async () => {
    reset();
    const row = makeRow('rid-stale', 'needs_editor', { status: 'needs_editor' }, 'old-hash');
    row.pipeline_editor_action_hash = 'action-a';
    row.pipeline_editor_idempotency_key = 'idem-a';
    table.push(row);
    const { payload, hash } = makeCallback('needs_editor', [{ id: 'new' }]);
    const base = {
      reportId: 'rid-stale', status: 'needs_editor' as const,
      pipelineValue: { status: 'needs_editor', sections: payload.sections }, callbackHash: hash,
    };
    expect(await applyPipelineCallback(base)).toBe('conflict');
    expect(await applyPipelineCallback({ ...base, idempotencyKey: 'wrong-key' })).toBe('conflict');
    expect(row.pipeline_editor_action_hash).toBe('action-a');
    expect(row.pipeline_editor_idempotency_key).toBe('idem-a');
  });

  it('requires the matching claim key to leave needs_editor', async () => {
    reset();
    const row = makeRow('rid-approve', 'needs_editor', { status: 'needs_editor' }, 'old-hash');
    row.pipeline_editor_action_hash = 'action-a';
    row.pipeline_editor_idempotency_key = 'idem-a';
    table.push(row);
    const { payload, hash } = makeCallback('approved', [{ id: 'final' }]);
    const base = {
      reportId: 'rid-approve', status: 'approved' as const,
      pipelineValue: { status: 'approved', sections: payload.sections }, callbackHash: hash,
    };
    expect(await applyPipelineCallback(base)).toBe('conflict');
    expect(await applyPipelineCallback({ ...base, idempotencyKey: 'idem-a' })).toBe('applied');
  });
});

describe('applyPipelineCallback — atomic transitions', () => {
  it('R2.5 nested fix: writes result.pipeline directly (not result.pipeline.pipeline)', async () => {
    reset();
    const row = makeRow('rid-1', 'queued');
    table.push(row);
    const { payload, hash } = makeCallback('approved', [{ id: 's1', prose: 'Your reading' }]);
    const outcome = await applyPipelineCallback({ reportId: 'rid-1', status: 'approved', pipelineValue: { status: 'approved', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(outcome).toBe('applied');
    // result.pipeline.status (not result.pipeline.pipeline.status)
    expect((row.result.pipeline as any).status).toBe('approved');
    expect((row.result.pipeline as any).pipeline).toBeUndefined();
    expect(row.pipeline_status).toBe('approved');
    expect(row.pipeline_callback_hash).toBe(hash);
  });

  it('R4 identical duplicate callback -> duplicate (no error)', async () => {
    reset();
    const row = makeRow('rid-2', 'needs_editor', { status: 'needs_editor' }, null);
    table.push(row);
    const { payload, hash } = makeCallback('needs_editor', [{ id: 's1' }]);
    // First apply
    const o1 = await applyPipelineCallback({ reportId: 'rid-2', status: 'needs_editor', pipelineValue: { status: 'needs_editor', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(o1).toBe('applied');
    // Same payload again -> duplicate
    const o2 = await applyPipelineCallback({ reportId: 'rid-2', status: 'needs_editor', pipelineValue: { status: 'needs_editor', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(o2).toBe('duplicate');
  });

  it('R4 same status but different payload -> conflict (409)', async () => {
    reset();
    const row = makeRow('rid-3', 'needs_editor', { status: 'needs_editor' }, 'prevhash');
    table.push(row);
    const { payload, hash } = makeCallback('needs_editor', [{ id: 'DIFFERENT' }]);
    const outcome = await applyPipelineCallback({ reportId: 'rid-3', status: 'needs_editor', pipelineValue: { status: 'needs_editor', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(outcome).toBe('conflict');
  });

  it('R2.4 terminal regression blocked (approved -> needs_editor)', async () => {
    reset();
    const row = makeRow('rid-4', 'approved', { status: 'approved' }, 'h');
    table.push(row);
    const { payload, hash } = makeCallback('needs_editor', [{ id: 's1' }]);
    const outcome = await applyPipelineCallback({ reportId: 'rid-4', status: 'needs_editor', pipelineValue: { status: 'needs_editor', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(outcome).toBe('regression');
    expect(row.pipeline_status).toBe('approved'); // unchanged
  });

  it('R2.2 unknown reportId -> not_found', async () => {
    reset();
    const { payload, hash } = makeCallback('approved', [{ id: 's1' }]);
    const outcome = await applyPipelineCallback({ reportId: 'nope', status: 'approved', pipelineValue: { status: 'approved', sections: payload.sections, judge: payload.judge, editorNote: null, rejectReasons: [], completedAt: 't' }, callbackHash: hash });
    expect(outcome).toBe('not_found');
  });

  it('approved callback persists sections and enables delivery via toPublicReport', () => {
    reset();
    const row = makeRow('rid-5', 'approved', {
      status: 'approved',
      sections: [{ id: 's1', prose: 'You are a sun in Aries' }],
      judge: { ok: true },
      editorNote: null,
      rejectReasons: [],
      completedAt: 't',
    }, 'h');
    const pub = toPublicReport(row as any);
    expect(pub.status).toBe('approved');
    expect(pub.pending).toBeUndefined();
    expect((pub.sections as any[]).length).toBe(1);
    expect((pub.sections as any[])[0].prose).toBe('You are a sun in Aries');
  });

  it('R3 paid needs_editor is NOT deliverable', () => {
    reset();
    const row = makeRow('rid-6', 'needs_editor', { status: 'needs_editor', sections: [{ id: 's1' }] }, 'h');
    const pub = toPublicReport(row as any);
    expect(pub.status).toBe('needs_editor');
    expect(pub.pending).toBe(true);
    expect(pub.sections).toEqual([]);
  });
});
