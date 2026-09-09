import { computeChart, geocodeLocation, localToJulianDay } from '@/lib/chartEngine';

// Offline fixture: 16:21 PST is 00:21 UTC on the following date.
const birth = { date: '1980-03-09', time: '16:21', location: '36.97412,-122.0308', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' };

describe('birth input correctness (offline)', () => {
  it('resolves coordinate input to Pacific, never an invented UTC default', async () => {
    expect(await geocodeLocation(birth.location)).toEqual({ lat: birth.latitude, lon: birth.longitude, timezone: birth.timezone });
  });
  it('converts the real Santa Cruz wall time and computes Leo ascendant', async () => {
    expect(localToJulianDay(1980, 3, 9, 16, 21, birth.timezone)).toBe(Date.UTC(1980, 2, 10, 0, 21) / 86400000 + 2440587.5);
    const chart = await computeChart(birth);
    expect(chart.ascendant.sign).toBe('leo');
    expect(chart.ascendant.longitude).toBeCloseTo(148.180952, 4);
  });
});
