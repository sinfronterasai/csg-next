import { computeChart, getEph } from '@/lib/chartEngine';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { Constants } from '@fusionstrings/swiss-eph';
const birth = { date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' };

afterEach(() => jest.restoreAllMocks());
it('keeps free chart core positions but never turns failed asteroid zeroes into placements', async () => {
  const eph = await getEph();
  const original = eph.swe_calc_ut.bind(eph);
  jest.spyOn(eph, 'swe_calc_ut').mockImplementation((jd, body, flags) => [Constants.SE_CHIRON, Constants.SE_JUNO].includes(body)
    ? { returnCode: -1, xx: new Float64Array(6), error: 'missing asteroid file' } : original(jd, body, flags));
  const chart = await computeChart(birth);
  expect(chart.sun.sign).toBe('pisces');
  expect(chart.ascendant.sign).toBe('leo');
  expect(chart.planets.some(p => ['chiron', 'juno'].includes(p.key))).toBe(false);
});
it('fails verified-facts preflight on missing asteroids, without fabricating verified zeroes', async () => {
  const eph = await getEph();
  const original = eph.swe_calc_ut.bind(eph);
  jest.spyOn(eph, 'swe_calc_ut').mockImplementation((jd, body, flags) => [Constants.SE_CHIRON, Constants.SE_JUNO].includes(body)
    ? { returnCode: -1, xx: new Float64Array(6), error: 'missing asteroid file' } : original(jd, body, flags));
  const result = await buildVerifiedFactsForReport('natal', birth);
  expect(result).toMatchObject({ ok: false, preflight: { status: 'input_incomplete' } });
  if (!result.ok) expect(JSON.stringify(result.preflight.missing)).toMatch(/chiron|juno/);
});
it('accepts a genuine zero longitude when the engine succeeded', async () => {
  const eph = await getEph();
  const original = eph.swe_calc_ut.bind(eph);
  jest.spyOn(eph, 'swe_calc_ut').mockImplementation((jd, body, flags) => body === Constants.SE_CHIRON
    ? { returnCode: flags, xx: new Float64Array([0, 1, 2, 0.1, 0, 0]), error: '' } : original(jd, body, flags));
  expect((await computeChart(birth)).planets.find(p => p.key === 'chiron')?.longitude).toBe(0);
});
it('does not forward geocode an immutable coordinate/timezone anchor', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network forbidden'));
  await computeChart({ ...birth, location: 'Unresolvable historical label' });
  expect(fetchSpy).not.toHaveBeenCalled();
});
