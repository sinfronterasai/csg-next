import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';

describe('Vocation & Wealth Map deterministic career windows', () => {
  it('produces an identical 24-month pack for the same snapshot date', async () => {
    const a: any = await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth, '2026-09-23');
    const b: any = await buildVerifiedFactsV2('vocation', KNOWN_TIME_ORDINARY.birth, '2026-09-23');
    const pack = a.reportData.vocationEvidence.careerWindowPack;
    expect(pack.canonicalWindowHash).toBe(b.reportData.vocationEvidence.careerWindowPack.canonicalWindowHash);
    expect(pack.months).toHaveLength(24);
    expect(pack.months.map((m: any) => m.key)).toEqual([...pack.months].sort((x: any, y: any) => x.key.localeCompare(y.key)).map((m: any) => m.key));
    expect(pack.targets).toEqual(expect.arrayContaining(['mc', 'saturn', 'jupiter']));
    expect(pack.targets.length).toBeLessThanOrEqual(5);
    expect(a.reportData.vocationEvidence.careerWindowsDeclared).toBe(true);
    expect(preflightReport('vocation', a).status).toBe('complete');
    for (const id of Object.keys(pack.facts)) expect(a.facts[id]).toBeDefined();
  });

  it('rejects an unknown-time chart before a report can become complete', async () => {
    const result = await buildVerifiedFactsForReport('vocation', UNKNOWN_TIME_SOLAR.birth);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.preflight.missing).toContain('vocation.knownBirthTime');
  });
});
