import { computeTransitBodies, moonPhase, dateToJulianDay } from '@/lib/transit';
import { localToJulianDay } from '@/lib/chartEngine';
import { signFromLongitude } from '@/lib/astrology';
import { FIXED_EXPECTED } from '../reports/fixtures/independentReferenceCorpus';

function moonLongitude(bodies: Awaited<ReturnType<typeof computeTransitBodies>>): number {
  return bodies.find((body) => body.key === 'moon')!.longitude;
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

// Independent fixture source: USNO Dates of Primary Phases of the Moon,
// https://aa.usno.navy.mil/calculated/moon/phases?year=2026 (UTC).
describe('independent Moon phase fixtures from USNO primary-phase table', () => {
  const fixtures = [
    { label: 'New Moon', iso: '2026-06-15T02:54:00Z', max: 3 },
    { label: 'First Quarter', iso: '2026-06-21T21:55:00Z', min: 45, max: 55 },
    { label: 'Full Moon', iso: '2026-06-29T23:56:00Z', min: 97, max: 100 },
    { label: 'Last Quarter', iso: '2026-07-07T19:29:00Z', min: 45, max: 55 },
  ];

  it.each(fixtures)('$label and one-hour boundaries have the expected illumination', async ({ label, iso, min = 0, max }) => {
    const eventMs = Date.parse(iso);
    const samples = [-60, 0, 60].map((offsetMinutes) => new Date(eventMs + offsetMinutes * 60_000));
    const results = await Promise.all(samples.map((date) => moonPhase(dateToJulianDay(date))));
    expect(results[1].label).toBe(label);
    for (const result of results) {
      const illumination = Math.round((1 - Math.cos(2 * Math.PI * result.phase)) * 50);
      expect(illumination).toBeGreaterThanOrEqual(min);
      expect(illumination).toBeLessThanOrEqual(max);
    }
  });
});

describe('Moon longitude independent fixtures and timezone invariance', () => {
  it('matches the committed NASA/JPL Moon longitude fixture at the reference instant', async () => {
    const bodies = await computeTransitBodies(dateToJulianDay(new Date('1990-06-15T10:00:00Z')));
    const longitude = moonLongitude(bodies);
    expect(angularDifference(longitude, FIXED_EXPECTED.moon.longitude)).toBeLessThanOrEqual(0.5);
    expect(signFromLongitude(longitude).sign.key).toBe(FIXED_EXPECTED.moon.sign);
  });

  it('keeps geocentric Moon longitude/sign invariant across requested timezones', async () => {
    const instants = [
      [1990, 6, 15, 10, 0, 'UTC'],
      [1990, 6, 15, 3, 0, 'America/Los_Angeles'],
      [1990, 6, 15, 6, 0, 'America/New_York'],
      [1990, 6, 15, 4, 0, 'America/Mexico_City'],
      [1990, 6, 15, 19, 0, 'Asia/Tokyo'],
    ] as const;
    const results = await Promise.all(instants.map(([year, month, day, hour, minute, timezone]) =>
      computeTransitBodies(localToJulianDay(year, month, day, hour, minute, timezone))
    ));
    const reference = moonLongitude(results[0]);
    const referenceSign = signFromLongitude(reference).sign.key;
    for (const bodies of results.slice(1)) {
      const longitude = moonLongitude(bodies);
      expect(angularDifference(longitude, reference)).toBeLessThan(0.001);
      expect(signFromLongitude(longitude).sign.key).toBe(referenceSign);
    }
  });

  it('handles both standard-time and daylight-saving conversions consistently', async () => {
    const winter = moonLongitude(await computeTransitBodies(localToJulianDay(2024, 1, 15, 12, 0, 'America/Los_Angeles')));
    const winterUtc = moonLongitude(await computeTransitBodies(dateToJulianDay(new Date('2024-01-15T20:00:00Z'))));
    const summer = moonLongitude(await computeTransitBodies(localToJulianDay(2024, 7, 15, 12, 0, 'America/Los_Angeles')));
    const summerUtc = moonLongitude(await computeTransitBodies(dateToJulianDay(new Date('2024-07-15T19:00:00Z'))));
    expect(angularDifference(winter, winterUtc)).toBeLessThan(0.001);
    expect(angularDifference(summer, summerUtc)).toBeLessThan(0.001);
  });
});
