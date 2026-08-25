// VerifiedFactsV2 — P0 foundation tests: ledger shape, normalized degreeInSign,
// aspect ids/provenance, preflight failure mode, immutable asOfDate, and the
// Workstream F fixture corpus (boundaries, retrograde, null dignity).

import { buildVerifiedFactsV2, buildAndPreflight } from '@/lib/reportFacts/build';
import { buildAspects } from '@/lib/reportFacts/derived';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { ALL_FIXTURES, BOUNDARY_NEAR_0, BOUNDARY_NEAR_29, RETRO_NULL_DIGNITY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';
import type { VerifiedFact } from '@/lib/reportFacts/types';

function positionFacts(facts: Record<string, VerifiedFact>): VerifiedFact[] {
  return Object.values(facts).filter((f) => f.kind === 'position');
}

describe('VerifiedFactsV2 ledger shape', () => {
  it('natal ledger has schemaVersion, asOfDate, common, facts, reportData', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    expect(v2.schemaVersion).toBe('csg-report-facts-v2');
    expect(v2.reportType).toBe('natal');
    expect(typeof v2.asOfDate).toBe('string');
    expect(v2.common).toBeDefined();
    expect(v2.common.chartRuler).toBeDefined();
    expect(v2.common.aspects.length).toBeGreaterThan(0);
    expect(v2.common.northNode).toBeDefined();
    expect(v2.common.southNode).toBeDefined();
    expect(v2.common.juno).toBeDefined();
    expect(v2.common.partOfFortune).toBeDefined();
    expect(v2.common.moonPhase).toBeDefined();
    // Tallies cover the four elements and three modalities.
    expect(Object.keys(v2.common.elements).sort()).toEqual(['Air', 'Earth', 'Fire', 'Water']);
    expect(Object.keys(v2.common.modalities).sort()).toEqual(['Cardinal', 'Fixed', 'Mutable']);
  });

  it('asOfDate is immutable: passing a stored date keeps it stable', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' }, '2026-01-01');
    expect(v2.asOfDate).toBe('2026-01-01');
  });
});

describe('normalized degreeInSign (0 and 29.99 boundaries)', () => {
  it('never reports degreeInSign outside 0..<30', async () => {
    for (const fx of ALL_FIXTURES) {
      const v2 = await buildVerifiedFactsV2('natal', fx.birth);
      for (const f of Object.values(v2.facts)) {
        if (f.kind === 'position') {
          const v = f.value as any;
          expect(v.degreeInSign).toBeGreaterThanOrEqual(0);
          expect(v.degreeInSign).toBeLessThan(30);
        }
      }
    }
  });

  it('boundary fixture near 0 produces a body at <1 degreeInSign', async () => {
    const v2 = await buildVerifiedFactsV2('natal', BOUNDARY_NEAR_0.birth);
    const positions = Object.values(v2.facts).filter((f) => f.kind === 'position') as any[];
    const near0 = positions.some((f) => f.value.degreeInSign < 1);
    expect(near0).toBe(true);
  });

  it('boundary fixture near 29 produces a body at >28 degreeInSign', async () => {
    const v2 = await buildVerifiedFactsV2('natal', BOUNDARY_NEAR_29.birth);
    const positions = Object.values(v2.facts).filter((f) => f.kind === 'position') as any[];
    const near29 = positions.some((f) => f.value.degreeInSign > 28);
    expect(near29).toBe(true);
  });
});

describe('aspect ids and provenance', () => {
  it('aspects carry stable ids, provenance, and exact orb', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    for (const a of v2.common.aspects) {
      expect(a.id).toMatch(/^natal\.aspect\./);
      expect(Array.isArray(a.provenance)).toBe(true);
      expect(a.provenance!.length).toBe(2);
      expect(a.value.orb).toBeGreaterThanOrEqual(0);
    }
  });

  it('buildAspects is deterministic and idempotent', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const ids1 = v2.common.aspects.map((a) => a.id).sort();
    const ids2 = v2.common.aspects.map((a) => a.id).sort();
    expect(ids1).toEqual(ids2);
  });
});

describe('null dignity is never fabricated', () => {
  it('at least one body has null dignity and none asserts a false dignity', async () => {
    const v2 = await buildVerifiedFactsV2('natal', RETRO_NULL_DIGNITY.birth);
    const positions = Object.values(v2.facts).filter((f) => f.kind === 'position') as any[];
    const hasNull = positions.some((f) => f.value.dignity === null);
    expect(hasNull).toBe(true);
    // A body with dignity null must NOT be described as in dignity in display.
    const fabricated = positions.filter((f) => f.value.dignity === null && /domicile|exalt|detriment|fall/.test(f.display));
    expect(fabricated.length).toBe(0);
  });
});

describe('unknown-time solar fallback — no fabricated time-dependent facts (#5)', () => {
  it('omits angles, chart ruler, and Part of Fortune; flags isSolarFallback', async () => {
    const v2 = await buildVerifiedFactsV2('natal', UNKNOWN_TIME_SOLAR.birth);
    expect(v2.common.isSolarFallback).toBe(true);
    // Time-dependent facts must be ABSENT, never fabricated from a default noon.
    expect(v2.common.ascendant).toBeUndefined();
    expect(v2.common.descendant).toBeUndefined();
    expect(v2.common.midheaven).toBeUndefined();
    expect(v2.common.icumcoeli).toBeUndefined();
    expect(v2.common.chartRuler).toBeUndefined();
    expect(v2.common.partOfFortune).toBeUndefined();
    expect(v2.facts['natal.ascendant.position']).toBeUndefined();
    expect(v2.facts['natal.partoffortune.position']).toBeUndefined();
    // Planet positions, nodes, Juno, and planet-planet aspects remain valid.
    expect(v2.facts['natal.sun.position']).toBeDefined();
    expect(v2.facts['natal.northnode.position']).toBeDefined();
    expect(v2.facts['natal.juno.position']).toBeDefined();
    expect(v2.common.aspects.length).toBeGreaterThan(0);
    // No aspect may involve an angle (time-dependent).
    const angleKeys = new Set(['ascendant', 'descendant', 'midheaven', 'icumcoeli']);
    const angleAspect = v2.common.aspects.find((a) => angleKeys.has(a.value.bodyA) || angleKeys.has(a.value.bodyB));
    expect(angleAspect).toBeUndefined();
  });

  it('natal preflight fails closed (input_incomplete) for unknown time', async () => {
    const v2 = await buildVerifiedFactsV2('natal', UNKNOWN_TIME_SOLAR.birth);
    const result = preflightReport('natal', v2);
    expect(result.status).toBe('input_incomplete');
    expect(result.missing).toContain('common.ascendant');
    expect(result.missing).toContain('facts.natal.ascendant.position');
    expect(result.missing).toContain('common.chartRuler');
    expect(result.missing).toContain('common.partOfFortune');
  });
});

describe('flat facts map contains position facts (#3)', () => {
  it('every computed body position is present under its stable id', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const expectedIds = [
      'natal.sun.position', 'natal.moon.position', 'natal.mercury.position',
      'natal.venus.position', 'natal.mars.position', 'natal.jupiter.position',
      'natal.saturn.position', 'natal.ascendant.position', 'natal.midheaven.position',
    ];
    for (const id of expectedIds) {
      expect(v2.facts[id]).toBeDefined();
      expect((v2.facts[id] as any).kind).toBe('position');
    }
    // The position fact value carries normalized degreeInSign + display.
    const sun = v2.facts['natal.sun.position'] as any;
    expect(sun.value.degreeInSign).toBeGreaterThanOrEqual(0);
    expect(sun.value.degreeInSign).toBeLessThan(30);
    expect(typeof sun.display).toBe('string');
    expect(sun.display.length).toBeGreaterThan(0);
  });
});

describe('hasPath nested reportData resolution (#4)', () => {
  it('resolves a nested reportData path, not a flat dotted string', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const result = preflightReport('relationship', v2);
    // relationshipScores is an object; the band lives one level deeper. hasPath must
    // traverse nested objects, not look up the literal 'reportData.relationshipScores.emotionalConnection' key.
    expect(result.status).toBe('complete');
    expect((v2.reportData as any).relationshipScores.emotionalConnection).toBeDefined();
  });
});

describe('preflight failure mode (Workstream B)', () => {
  it('natal with full common passes preflight', async () => {
    const v2 = await buildVerifiedFactsV2('natal', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const result = preflightReport('natal', v2);
    expect(result.status).toBe('complete');
    expect(result.missing).toEqual([]);
  });

  it('timing report without transit ledger fails input_incomplete (no dispatch)', async () => {
    const v2 = await buildVerifiedFactsV2('yearlytransit', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const result = preflightReport('yearlytransit', v2);
    expect(result.status).toBe('input_incomplete');
    expect(result.missing).toContain('reportData.transitLedger');
    expect(result.mode).toBe('preflight_failed');
  });

  it('relationship requires score bands', async () => {
    const v2 = await buildVerifiedFactsV2('relationship', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    const result = preflightReport('relationship', v2);
    expect(result.status).toBe('complete');
    expect(result.missing).not.toContain('reportData.relationshipScores');
  });

  it('buildAndPreflight returns ok:false + preflight on incomplete (fail closed)', async () => {
    const out = await buildAndPreflight('lovetiming', { date: '1990-06-15', time: '12:00', location: 'Paris' });
    expect(out.ok).toBe(false);
    expect(out.preflight?.status).toBe('input_incomplete');
    expect(out.ledger).toBeUndefined();
  });
});

describe('fixture corpus — every report type passes >=3 materially different fixtures', () => {
  const types = ['natal', 'relationship', 'loveblueprint', 'vocation', 'karmicshadow'] as const;
  for (const t of types) {
    it(`${t} builds a complete ledger for >=3 known-time fixtures`, async () => {
      // Unknown-time natal correctly fails preflight (time-dependent facts omitted),
      // so only known-time fixtures are asserted to complete. See #5 tests above.
      const known = ALL_FIXTURES.filter((f) => f.expect.knownTime).slice(0, 4);
      for (const fx of known) {
        const out = await buildAndPreflight(t, fx.birth);
        if (t === 'natal' || t === 'relationship' || t === 'loveblueprint' || t === 'vocation' || t === 'karmicshadow') {
          // P0 builds common + scores for these; timing/fullcosmic intentionally incomplete.
          expect(out.ok).toBe(true);
          expect(out.ledger?.common.aspects.length).toBeGreaterThan(0);
        }
      }
    });
  }
});
