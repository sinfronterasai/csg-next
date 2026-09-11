import { compilePremiumNatalReport, buildNarrativePrompt } from '@/lib/deterministicReportCompiler';
import type { VerifiedFactsV2, VerifiedFact, PositionValue } from '@/lib/reportFacts/types';

function position(key: string, label: string, display: string, overrides: Partial<PositionValue> = {}): VerifiedFact {
  const value: PositionValue = {
    key, label, longitude: 10, degreeInSign: 10, sign: 'aries', signLabel: 'Aries', house: 1,
    retrograde: false, dignity: null, ...overrides,
  };
  return { id: `natal.${key}.position`, kind: 'position', source: 'swiss-ephemeris', display, value };
}

function ledger(overrides: Partial<VerifiedFactsV2> = {}): VerifiedFactsV2 {
  const positions = [
    position('sun', 'Sun', 'Sun — 10° Aries — House 1', { longitude: 10, retrograde: true, dignity: 'domicile' }),
    position('moon', 'Moon', 'Moon — 20° Taurus — House 2', { longitude: 50, degreeInSign: 20, sign: 'taurus', signLabel: 'Taurus', house: 2 }),
    position('mercury', 'Mercury', 'Mercury — 5° Gemini — House 3', { longitude: 65, degreeInSign: 5, sign: 'gemini', signLabel: 'Gemini', house: 3 }),
    ...(['venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const).map((key) => position(key, key[0].toUpperCase() + key.slice(1), `${key} — 10° Aries — House 1`)),
  ];
  const facts = Object.fromEntries(positions.map((fact) => [fact.id, fact]));
  return {
    schemaVersion: 'csg-report-facts-v2', reportType: 'natal', asOfDate: '2026-01-01', facts,
    common: { positions, northNode: positions[0].value as any, southNode: positions[0].value as any, juno: positions[0].value as any,
      elements: { id: 'natal.elements', kind: 'tally', source: 'derived-deterministic', display: 'Fire 1', value: {} },
      modalities: { id: 'natal.modalities', kind: 'tally', source: 'derived-deterministic', display: 'Cardinal 1', value: {} },
      aspects: [], topAspectByBody: positions[0], patterns: [], isSolarFallback: false },
    reportData: {}, ...overrides,
  };
}

describe('deterministic Premium Natal compiler', () => {
  it('renders canonical ledger placements in stable order without internal IDs', () => {
    const result = compilePremiumNatalReport(ledger());
    expect(result.tables.planets.map((row) => row.body)).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
    expect(result.tables.planets[0]).toEqual({ body: 'Sun', sign: 'Aries', degree: '10°', house: '1', retrograde: 'Retrograde', dignity: 'domicile' });
    expect(JSON.stringify(result.tables)).not.toContain('natal.sun.position');
    expect(result.narrativeSlots.map((slot) => slot.id)).toEqual(['identity', 'inner-world', 'integration']);
  });

  it('keeps canonical ordering when the ledger array is shuffled', () => {
    const source = ledger();
    const shuffled = { ...source, common: { ...source.common, positions: [...source.common.positions].reverse() } };
    expect(compilePremiumNatalReport(shuffled).tables.planets.map((row) => row.body)).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
  });

  it('fails closed for missing or invalid factual positions', () => {
    const missing = ledger({ common: { ...ledger().common, positions: [] } });
    expect(() => compilePremiumNatalReport(missing)).toThrow(/position|required/i);
    const invalid = ledger();
    (invalid.common.positions[0].value as PositionValue).degreeInSign = 99;
    expect(() => compilePremiumNatalReport(invalid)).toThrow(/invalid|degree/i);
  });

  it('builds compact section-specific LLM input with no factual fields to author', () => {
    const compiled = compilePremiumNatalReport(ledger());
    const prompt = buildNarrativePrompt(compiled, 'identity');
    expect(prompt).toEqual({ sectionId: 'identity', role: 'warm interpreter', wordLimit: { min: 90, max: 140 }, facts: [
      { label: 'Sun', display: 'Sun — 10° Aries — House 1' },
    ] });
    expect(Object.keys(prompt)).toEqual(['sectionId', 'role', 'wordLimit', 'facts']);
    expect(Object.keys(prompt.facts[0])).toEqual(['label', 'display']);
    expect(JSON.stringify(prompt)).not.toContain('longitude');
    expect(JSON.stringify(prompt)).not.toContain('degreeInSign');
  });

  it('rejects model-shaped factual input at the adapter boundary', () => {
    const compiled = compilePremiumNatalReport(ledger());
    expect(() => buildNarrativePrompt(compiled, 'identity', { sign: 'Pisces', degree: '29°' })).toThrow(/factual fields/i);
  });
});
