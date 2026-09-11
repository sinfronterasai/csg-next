import {
  buildDispatchPayload,
  convertCompactCallback,
  getPremiumNatalWorkflow,
  type CompactCallback,
} from '@/lib/reportPipeline';

const facts = {
  schemaVersion: 'csg-report-facts-v2', reportType: 'natal', asOfDate: '2026-01-01',
  facts: {}, common: { isSolarFallback: false, positions: [], aspects: [], houses: [], patterns: [] },
} as any;

const compiled = {
  schemaVersion: 'csg-premium-natal-compiled-v1',
  metadata: { reportType: 'natal', asOfDate: '2026-01-01', solarFallback: false },
  facts: [{ id: 'natal.sun.position', label: 'Sun', display: 'Sun — 10° Aries — House 1' }],
  tables: { planets: [{ key: 'sun' }], aspects: [], houses: [], patterns: [] },
  narrativeSlots: ['identity', 'inner-world', 'integration', 'dynamics'].map((id) => ({
    id, role: 'interpreter', wordLimit: { min: 1, max: 10 }, relevantFactIds: ['natal.sun.position'],
  })),
} as any;
const callback = (overrides: Partial<CompactCallback> = {}): CompactCallback => ({
  schemaVersion: 'csg-compact-report-callback-v1', reportId: 'report-1', status: 'approved',
  reportType: 'natal', skeleton: {}, tables: { hacked: true },
  blocks: ['identity', 'inner-world', 'integration', 'dynamics'].map((sectionId) => ({
    sectionId, blocks: [{ role: 'narrative', prose: `Text ${sectionId}`, factIds: ['natal.sun.position'] }],
  })), ...overrides,
});

describe('compact dispatch seam', () => {
  it('selects compact only for explicitly configured Premium Natal', () => {
    expect(getPremiumNatalWorkflow({ N8N_PREMIUM_NATAL_WORKFLOW: 'compact' }, 'natalpremium')).toBe('compact');
    expect(getPremiumNatalWorkflow({ N8N_PREMIUM_NATAL_WORKFLOW: 'compact' }, 'natal')).toBe('legacy');
    expect(getPremiumNatalWorkflow({}, 'natalpremium')).toBe('legacy');
  });
  it('sends full facts to deterministic code and only packs to writer input', () => {
    const payload = buildDispatchPayload({ reportId: 'report-1', reportType: 'natalpremium', tier: 'paid', birthData: {} as any, verifiedFacts: facts, compiled, callbackUrl: 'https://app.test/callback' }, 'compact');
    expect(payload.verifiedFacts).toBe(facts);
    expect(payload.deterministic).toEqual({ schemaVersion: compiled.schemaVersion, tables: compiled.tables, skeleton: expect.anything() });
    expect(payload.narrativeFactPacks).toHaveLength(4);
    expect(payload.writerInput).toBeUndefined();
    expect(JSON.stringify(payload.narrativeFactPacks)).not.toContain('csg-report-facts-v2');
  });
});

describe('compact callback conversion', () => {
  it('maps approved compact slots into the existing pipeline contract and discards tables', () => {
    const mapped = convertCompactCallback(callback(), { reportId: 'report-1', compiled });
    expect(mapped).toMatchObject({ reportId: 'report-1', status: 'approved', judge: { source: 'compact' } });
    expect(mapped.sections).toHaveLength(4);
    expect(mapped).not.toHaveProperty('tables');
    expect(mapped.sections[0].blocks[0].role).toBe('meaning');
  });
  it.each([
    ['stale correlation', callback({ reportId: 'other' })],
    ['unknown slot', callback({ blocks: [...callback().blocks.slice(0, 3), { sectionId: 'secret', blocks: [] }] })],
    ['missing slot', callback({ blocks: callback().blocks.slice(0, 3) })],
    ['missing tables', callback({ tables: undefined as any })],
    ['missing facts', callback({ blocks: callback().blocks.map((b) => ({ ...b, blocks: [{ ...b.blocks[0], factIds: ['missing.fact'] }] })) })],
    ['malformed callback', { reportId: 'report-1' } as any],
  ])('fails closed for %s', (_name, value) => {
    expect(() => convertCompactCallback(value, { reportId: 'report-1', compiled })).toThrow();
  });
  it('converts a rejected callback without prose or judge data', () => {
    const mapped = convertCompactCallback(callback({ status: 'rejected', blocks: [], rejectReasons: ['quality gate'] }), { reportId: 'report-1', compiled });
    expect(mapped).toEqual({ reportId: 'report-1', status: 'rejected', sections: [], judge: undefined, rejectReasons: ['quality gate'] });
  });
});
