import { canonicalJson, canonicalSha256 } from '@/lib/yearlyTransit/canonical';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';
import { buildRollingUtcPeriod, isInInclusivePeriod } from '@/lib/yearlyTransit/period';
import { YEARLY_TRANSIT_VERSIONS, YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS, YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES } from '@/lib/yearlyTransit/versions';
import { ACTIVE_ORBS, DEFAULT_MOVING_BODIES, DEFAULT_NATAL_TARGETS, validateKnownTimeBirth } from '@/lib/yearlyTransit/policy';
import { REPORT_META } from '@/lib/reportEngine';
import { mapReportType } from '@/lib/reportPipeline';

describe('yearly transit Phase 1 contracts', () => {
  it('uses the authoritative $49 internal product price and external mapping', () => {
    expect(REPORT_META.transit.price).toBe(49);
    expect(mapReportType('transit')).toBe('yearlytransit');
  });

  it('rejects unknown-time birth input before any engine work', () => {
    expect(() => validateKnownTimeBirth({ date: '1980-03-09', time: '16:21', unknownTime: true })).toThrow(/known birth time/);
    expect(() => validateKnownTimeBirth({ date: '1980-03-09', time: undefined })).toThrow(/known birth time/);
    expect(() => validateKnownTimeBirth({ date: '1980-03-09', time: '16:21' })).not.toThrow();
  });

  it('freezes local-midnight rolling boundaries across DST', () => {
    const period = buildRollingUtcPeriod('2027-03-14', 'America/Los_Angeles');
    expect(period.fromUtc).toBe('2027-03-14T08:00:00.000Z');
    expect(period.toUtc).toBe('2028-03-14T07:00:00.000Z');
    expect(isInInclusivePeriod(period.fromUtc, period)).toBe(true);
    expect(isInInclusivePeriod(period.toUtc, period)).toBe(true);
  });

  it('exposes the locked default geometry and allowlists', () => {
    expect(DEFAULT_MOVING_BODIES).toEqual(['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']);
    expect(DEFAULT_NATAL_TARGETS).toContain('asc');
    expect(DEFAULT_NATAL_TARGETS).toContain('mc');
    expect(DEFAULT_NATAL_TARGETS).toContain('northnode');
    expect(DEFAULT_NATAL_TARGETS).toContain('chiron');
    expect(ACTIVE_ORBS).toEqual({ conjunction: 8, opposition: 8, square: 6, trine: 6, sextile: 5 });
  });

  it('has an explicit version owner bundle and refinement constants', () => {
    expect(Object.keys(YEARLY_TRANSIT_VERSIONS)).toHaveLength(6);
    expect(YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES).toBe(1);
    expect(YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS).toBe(60);
  });

  it('fits the provisional immutable jsonb snapshot contract and is canonically stable', () => {
    const pack = buildWorstCaseYearlyTransitPack();
    const json = canonicalJson(pack);
    const byteLength = Buffer.byteLength(json, 'utf8');
    console.info(`yearly-transit worst-case canonical bytes: ${byteLength}`);
    expect(byteLength).toBeGreaterThan(0);
    expect(pack.aiPacks.primaryWindows).toHaveLength(8);
    expect(pack.aiPacks.monthlyContext).toHaveLength(12);
    expect(pack.aiPacks.appendixEvidence.length).toBeGreaterThan(0);
    const { canonicalJsonSha256, ...unsigned } = pack;
    expect(canonicalJsonSha256).toBe(canonicalSha256(unsigned));
    // PostgreSQL jsonb stores this as structured JSON; this gate records the
    // measured fixture size without requiring a production database connection.
    expect(Buffer.byteLength(json, 'utf8')).toBeLessThan(1_000_000);
  });
});
