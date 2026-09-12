import { applyPipelineCallback, canonicalCallbackHash, toPublicReport } from '@/lib/profile/store';

// In-memory fake of the `readings` table + transaction helper used by store.ts.
// Supports exactly the two statements applyPipelineCallback issues.
interface Row {
  id: number;
  type: string;
  result: any;
  pipeline_status: string | null;
  pipeline_callback_hash: string | null;
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
  };
}

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  transaction: async (fn: any) => {
    const txQuery = async (text: string, params?: any[]) => {
      // Lock select (FOR UPDATE)
      if (text.includes('FOR UPDATE')) {
        const rid = params![0];
        const found = table.find((r) => r.type === 'report' && r.result.reportId === rid);
        return { rows: found ? [{ id: found.id, pipeline_status: found.pipeline_status, pipeline_callback_hash: found.pipeline_callback_hash }] : [] };
      }
      // Update
      if (text.startsWith('UPDATE readings')) {
        const id = params![0];
        const pipelineValue = JSON.parse(params![1]);
        const status = params![2];
        const hash = params![3];
        const row = table.find((r) => r.id === id);
        if (row) {
          row.result = { ...row.result, pipeline: pipelineValue };
          row.pipeline_status = status;
          row.pipeline_callback_hash = hash; // persist hash so duplicates detect
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
