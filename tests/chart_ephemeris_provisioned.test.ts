import { computeChart, getEph, localToJulianDay, PLANET_BODIES } from '@/lib/chartEngine';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { Constants } from '@fusionstrings/swiss-eph';

// Opt-in release gate: never mock the engine or silently skip missing data.
// Run with SWISS_EPHEMERIS_DIR pointing at the pinned, provisioned data bundle.
const provisioned = process.env.SWISS_EPHEMERIS_DIR ? describe : describe.skip;
const birth = { date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' };
provisioned('real provisioned ephemeris release gate', () => {
  it('computes every mandatory body and the complete shared Free Natal/paid ledger offline', async () => {
    const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network forbidden'));
    try {
      const eph = await getEph();
      const jd = localToJulianDay(1980, 3, 9, 16, 21, birth.timezone);
      expect(jd).toBe(Date.UTC(1980, 2, 10, 0, 21) / 86400000 + 2440587.5);
      for (const body of PLANET_BODIES) {
        const result = eph.swe_calc_ut(jd, body.se, Constants.SEFLG_SWIEPH | Constants.SEFLG_SPEED);
        expect({ body: body.key, error: result.error, code: result.returnCode }).toEqual({ body: body.key, error: '', code: 258 });
        expect(Array.from(result.xx).every(Number.isFinite)).toBe(true);
      }
      const chart = await computeChart(birth);
      expect(chart.planets.map(p => p.key).sort()).toEqual(PLANET_BODIES.map(p => p.key).sort());
      expect(chart.ascendant.longitude).toBeCloseTo(148.180952, 4);
      const result = await buildVerifiedFactsForReport('natal', birth);
      expect(result).toMatchObject({ ok: true });
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
