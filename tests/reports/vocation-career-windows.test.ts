import { buildVerifiedFactsV2 } from '@/lib/reportFacts/build';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { KNOWN_TIME_ORDINARY, UNKNOWN_TIME_SOLAR } from './fixtures/factsFixtures';

const DETERMINISTIC_PARIS_KNOWN_BIRTH = {
  ...KNOWN_TIME_ORDINARY.birth,
  latitude: 48.8566,
  longitude: 2.3522,
  timezone: 'Europe/Paris',
};
const DETERMINISTIC_PARIS_UNKNOWN_BIRTH = {
  ...UNKNOWN_TIME_SOLAR.birth,
  latitude: 48.8566,
  longitude: 2.3522,
  timezone: 'Europe/Paris',
};

let deterministicPackA: any;
let deterministicPackB: any;
let unknownTimeResult: Awaited<ReturnType<typeof buildVerifiedFactsForReport>>;

describe('Vocation & Wealth Map deterministic career windows', () => {
  beforeAll(async () => {
    [deterministicPackA, deterministicPackB, unknownTimeResult] = await Promise.all([
      buildVerifiedFactsV2('vocation', DETERMINISTIC_PARIS_KNOWN_BIRTH, '2026-09-23'),
      buildVerifiedFactsV2('vocation', DETERMINISTIC_PARIS_KNOWN_BIRTH, '2026-09-23'),
      buildVerifiedFactsForReport('vocation', DETERMINISTIC_PARIS_UNKNOWN_BIRTH),
    ]);
  }, 60000);
  it('produces an identical 24-month pack for the same snapshot date', async () => {
    const a: any = deterministicPackA;
    const b: any = deterministicPackB;
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
    const result = unknownTimeResult;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.preflight.missing).toContain('vocation.knownBirthTime');
  });
});
