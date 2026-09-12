import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { compileFreeBirthChart, validateFreeBirthInput } from '@/lib/freeBirthChart';

const birth = {
  date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA',
  latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles',
};

describe('Free Birth Chart deterministic vertical slice', () => {
  it('compiles customer-safe placements and tables from the verified ledger', async () => {
    const result = await buildVerifiedFactsForReport('natal', birth);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('fixture ledger did not build');

    const report = compileFreeBirthChart(result.ledger);
    expect(report.schemaVersion).toBe('csg-free-birth-chart-v1');
    expect(report.placements).toHaveLength(12);
    expect(report.placements.map((p) => p.key)).toEqual([
      'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'juno',
    ]);
    expect(report.placements.every((p) => !JSON.stringify(p).includes('natal.'))).toBe(true);
    expect(report.tables.planets[0]).toEqual(expect.objectContaining({ body: 'Sun', sign: expect.any(String) }));
    expect(JSON.stringify(report)).not.toMatch(/internal|fact|provenance|ledger/i);
  });

  it('fails closed when an authoritative placement is missing', async () => {
    const result = await buildVerifiedFactsForReport('natal', birth);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('fixture ledger did not build');
    const missing = { ...result.ledger, common: { ...result.ledger.common, positions: result.ledger.common.positions.filter((f) => f.id !== 'natal.juno.position') } };
    expect(() => compileFreeBirthChart(missing)).toThrow(/missing position juno/);
  });

  it('validates canonical birth inputs before computation', () => {
    expect(validateFreeBirthInput({ ...birth })).toEqual({ ok: true, value: expect.any(Object) });
    expect(validateFreeBirthInput({ ...birth, date: '1980-02-30' }).ok).toBe(false);
    expect(validateFreeBirthInput({ ...birth, timezone: 'UTC', latitude: 91 }).ok).toBe(false);
    expect(validateFreeBirthInput({ ...birth, latitude: 1, longitude: undefined }).ok).toBe(false);
  });
});
