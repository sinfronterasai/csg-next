/// <reference types="jest" />
// Security/privacy contract for toPublicReport: the public/shared/owner JSON must
// carry ONLY the exact public section and overview shapes. Stored callback
// sections contain factsCited (internal evidence ids) and may carry arbitrary
// secret keys, judge data, tokens, and user ids. None of that may reach a
// client, even though the UI/PDF already drops factsCited visually.
//
// toPublicReport is a pure mapping over a reading record; no DB access here.
import { toPublicReport } from '@/lib/profile/store';

// Minimal record builder mirroring the readings row shape toPublicReport reads.
function makeRec(opts: {
  pipelineStatus?: string | null;
  pipeline?: any;
  result?: any;
}): any {
  return {
    id: 42,
    type: 'report',
    title: 'Natal Birth Chart Report',
    createdAt: '2026-08-01T00:00:00Z',
    pipelineStatus: opts.pipelineStatus ?? null,
    result: {
      reportId: 'rid-sec',
      title: 'Natal Birth Chart Report',
      reportType: 'natal',
      ...(opts.result ?? {}),
      ...(opts.pipeline ? { pipeline: opts.pipeline } : {}),
    },
  };
}

// A stored approved section deliberately laced with internal/secret fields.
const LACED_STORED_SECTION = {
  id: 'coreIdentity',
  prose: 'You are grounded and steady.',
  factsCited: ['sun-in-capricorn', 'asc-virgo'],
  judge: { score: 0.97, grader: 'gpt-judge-internal' },
  callbackToken: 'cb-secret-token-xyz',
  userId: 9001,
  internalNote: 'do-not-ship',
  extraArbitrary: { nested: 'secret' },
};

describe('toPublicReport — public contract sanitization', () => {
  it('approved: returns exact {id, prose} sections and strips factsCited/judge/tokens/userIds/arbitrary keys', () => {
    const rec = makeRec({
      pipelineStatus: 'approved',
      pipeline: { status: 'approved', sections: [LACED_STORED_SECTION], judge: { score: 0.97 } },
    });
    const pub = toPublicReport(rec);
    expect(pub.status).toBe('approved');
    const sections = pub.sections as any[];
    expect(sections).toHaveLength(1);
    // exact shape: ONLY id + prose keys
    expect(Object.keys(sections[0]).sort()).toEqual(['id', 'prose']);
    expect(sections[0]).toEqual({ id: 'coreIdentity', prose: 'You are grounded and steady.' });

    // None of the internal values may appear anywhere in the serialized output.
    const json = JSON.stringify(pub);
    expect(json).not.toContain('factsCited');
    expect(json).not.toContain('sun-in-capricorn');
    expect(json).not.toContain('asc-virgo');
    expect(json).not.toContain('gpt-judge-internal');
    expect(json).not.toContain('cb-secret-token-xyz');
    expect(json).not.toContain('9001');
    expect(json).not.toContain('do-not-ship');
    expect(json).not.toContain('extraArbitrary');
  });

  it.each(['queued', 'pending', 'processing', 'needs_editor', 'rejected'])(
    'non-approved status %s: returns empty sections and hides stored secret prose',
    (status) => {
      const rec = makeRec({
        pipelineStatus: status,
        pipeline: {
          status,
          sections: [
            { id: 'coreIdentity', prose: 'SECRET-PROSE-PAYLOAD', factsCited: ['secret-fact'] },
          ],
          judge: { score: 1 },
          qualityArtifact: { failedSections: ['coreIdentity'], scores: { narrativeDepth: 1 }, internal: 'QUALITY-SECRET' },
        },
      });
      const pub = toPublicReport(rec);
      expect(pub.sections).toEqual([]);
      const json = JSON.stringify(pub);
      expect(json).not.toContain('SECRET-PROSE-PAYLOAD');
      expect(json).not.toContain('secret-fact');
      expect(json).not.toContain('QUALITY-SECRET');
      expect(json).not.toContain('qualityArtifact');
      expect(json).not.toContain('narrativeDepth');
    },
  );

  it('approved: drops malformed section entries but keeps valid {id, prose}', () => {
    const rec = makeRec({
      pipelineStatus: 'approved',
      pipeline: {
        status: 'approved',
        sections: [
          { id: 'good', prose: 'Real body.' },
          { id: 'empty', prose: '' },
          { id: 'blank', prose: '   ' },
          { id: 'noProse' },
          null,
          42,
          { prose: 'No id but prose.' },
          { id: 'withSecret', prose: 'Body.', factsCited: ['x'] },
        ],
      },
    });
    const pub = toPublicReport(rec);
    const sections = pub.sections as any[];
    // keeps entries with real prose, normalizes to {id, prose} (id fallback when absent)
    expect(sections).toEqual([
      { id: 'good', prose: 'Real body.' },
      { id: expect.any(String), prose: 'No id but prose.' },
      { id: 'withSecret', prose: 'Body.' },
    ]);
    expect(JSON.stringify(pub)).not.toContain('factsCited');
  });

  it('overview: only exact {glyph?, label, value, note?} string rows reach public output; malformed rows dropped', () => {
    const rec = makeRec({
      pipelineStatus: 'approved',
      result: {
        overview: [
          { glyph: '☉', label: 'Sun', value: 'Capricorn', note: 'Core' },
          { label: 'Moon', value: 'Cancer' },                       // no glyph/note: allowed
          { glyph: 123, label: 'Bad', value: 'Row' },               // non-string glyph -> dropped/coerced
          { label: '', value: 'EmptyLabel' },                        // empty label -> dropped
          { label: 'NoValue' },                                      // missing value -> dropped
          { glyph: '♄', label: 'Saturn', value: 'Aries', note: 42 }, // non-string note -> sanitized
          'not-an-object',
          null,
        ],
      },
      pipeline: { status: 'approved', sections: [{ id: 's', prose: 'Body.' }] },
    });
    const pub = toPublicReport(rec);
    const overview = (pub as any).overview as any[];
    // every emitted row has only allowed keys and string values
    for (const row of overview) {
      for (const k of Object.keys(row)) {
        expect(['glyph', 'label', 'value', 'note']).toContain(k);
        expect(typeof row[k]).toBe('string');
      }
      expect(typeof row.label).toBe('string');
      expect(row.label.length).toBeGreaterThan(0);
      expect(typeof row.value).toBe('string');
    }
    // the obviously-malformed rows are gone
    expect(JSON.stringify(overview)).not.toContain('not-an-object');
    // valid rows survive
    expect(overview.some((r) => r.label === 'Sun' && r.value === 'Capricorn')).toBe(true);
    expect(overview.some((r) => r.label === 'Moon' && r.value === 'Cancer')).toBe(true);
  });

  it('does not throw on missing pipeline / missing result (defensive)', () => {
    expect(() => toPublicReport(makeRec({ pipelineStatus: 'queued' }))).not.toThrow();
    expect(() => toPublicReport(makeRec({ pipelineStatus: null }))).not.toThrow();
  });
});
