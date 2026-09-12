import { Constants } from '@fusionstrings/swiss-eph';
import {
  NAVIGATOR_FLAGS,
  NavigatorCalculationError,
  buildNatalNavigator,
  resolveSavedBirthAnchor,
  validateNatalNavigatorResponse,
} from '@/lib/constellations/natal';
import { getPlanet, signFromLongitude } from '@/lib/astrology';
import { readFileSync } from 'fs';
import { join } from 'path';

const independentFixture = JSON.parse(readFileSync(join(process.cwd(), 'data/astronomy/cosmic-navigator-independent-fixtures.json'), 'utf8'));

const placements = [
  ['sun', 349.1], ['moon', 270.2], ['mercury', 336.3], ['venus', 35.4], ['mars', 148.5],
  ['jupiter', 155.6], ['saturn', 174.7], ['uranus', 235.8], ['neptune', 262.9], ['pluto', 203.1],
  ['chiron', 42.2], ['juno', 70.3], ['northnode', 149.4],
].map(([key, longitude], index) => ({
  key, label: getPlanet(String(key))?.label ?? String(key), glyph: getPlanet(String(key))?.glyph ?? '•', longitude: Number(longitude), degreeInSign: signFromLongitude(Number(longitude)).degreeInSign,
  sign: signFromLongitude(Number(longitude)).sign.key, signLabel: signFromLongitude(Number(longitude)).sign.label,
  signGlyph: signFromLongitude(Number(longitude)).sign.glyph, house: (index % 12) + 1, retrograde: false,
  dignity: null, description: '',
}));

const row = {
  birth_date: '1980-03-09', birth_time: '16:21:00', timezone: 'America/Los_Angeles',
  latitude: 36.97412, longitude: -122.0308, unknown_time: false,
  natal_positions: { planets: placements },
};

describe('saved birth anchor conversion', () => {
  it('converts a normal zoned wall time to the exact UTC instant and Julian day', () => {
    const anchor = resolveSavedBirthAnchor(row);
    expect(anchor.utc).toBe('1980-03-10T00:21:00.000Z');
    expect(anchor.julianDayUt).toBe(Date.UTC(1980, 2, 10, 0, 21) / 86400000 + 2440587.5);
  });

  it('converts an unambiguous time immediately after the DST spring boundary', () => {
    const anchor = resolveSavedBirthAnchor({ ...row, birth_date: '2024-03-10', birth_time: '03:30', timezone: 'America/New_York' });
    expect(anchor.utc).toBe('2024-03-10T07:30:00.000Z');
  });

  it('rejects nonexistent and ambiguous local times rather than choosing an approximation', () => {
    expect(() => resolveSavedBirthAnchor({ ...row, birth_date: '2024-03-10', birth_time: '02:30', timezone: 'America/New_York' })).toThrow(NavigatorCalculationError);
    expect(() => resolveSavedBirthAnchor({ ...row, birth_date: '2024-11-03', birth_time: '01:30', timezone: 'America/New_York' })).toThrow(NavigatorCalculationError);
  });

  it.each([
    { timezone: null }, { latitude: null }, { longitude: Infinity }, { birth_time: null },
    { birth_date: 'not-a-date' }, { latitude: 91 }, { longitude: -181 },
    { birth_date: '1980-03-09garbage' }, { birth_time: '16:21:00garbage' },
    { latitude: ' ' }, { longitude: '\t' },
  ])('rejects an incomplete or invalid saved anchor %#', (change) => {
    expect(() => resolveSavedBirthAnchor({ ...row, ...change })).toThrow(NavigatorCalculationError);
  });
});

describe('server natal coordinate calculation', () => {
  it('requests ICRS astrometric geocentric equatorial Cartesian Swiss output', () => {
    expect(NAVIGATOR_FLAGS).toBe(
      Constants.SEFLG_SWIEPH | Constants.SEFLG_EQUATORIAL | Constants.SEFLG_XYZ |
      Constants.SEFLG_J2000 | Constants.SEFLG_NONUT | Constants.SEFLG_NOABERR | Constants.SEFLG_NOGDEFL |
      Constants.SEFLG_ICRS,
    );
    expect(NAVIGATOR_FLAGS).toBe(138850);
  });

  it('returns ten primary bodies in exact order and keeps saved longitude values byte-for-number', async () => {
    const payload = await buildNatalNavigator(row);
    expect(payload.bodies.filter(body => body.category === 'primary').map(body => body.key)).toEqual([
      'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
    ]);
    for (const body of payload.bodies.filter(body => body.status === 'available')) {
      expect(Number.isFinite(body.rightAscensionDeg)).toBe(true);
      expect(body.rightAscensionDeg).toBeGreaterThanOrEqual(0);
      expect(body.rightAscensionDeg).toBeLessThan(360);
      expect(body.declinationDeg).toBeGreaterThanOrEqual(-90);
      expect(body.declinationDeg).toBeLessThanOrEqual(90);
      const length = Math.hypot(body.vector!.x, body.vector!.y, body.vector!.z);
      expect(length).toBeCloseTo(1, 10);
      expect(body.longitude).toBe(placements.find(p => p.key === body.key)!.longitude);
    }
    expect(payload.birthAnchor.utc).toBe('1980-03-10T00:21:00.000Z');
    expect(payload.frame.epoch).toBe(payload.birthAnchor.utc);
    expect(payload.frame.reference).toBe('ICRS');
    expect(validateNatalNavigatorResponse(payload)).toBe(true);
    const sun = payload.bodies.find(body => body.key === 'sun')!;
    if (sun.status !== 'available') throw new Error('Sun must be available');
    // Independent direct Swiss Ephemeris 2.10.03 fixture prepared without the
    // production conversion utilities, at JD 2444308.5145833334.
    expect(independentFixture.swissFlags).toBe(NAVIGATOR_FLAGS);
    expect(sun.rightAscensionDeg).toBeCloseTo(independentFixture.planet.rightAscensionDeg, 8);
    expect(sun.declinationDeg).toBeCloseTo(independentFixture.planet.declinationDeg, 8);
    expect(sun.vector!.x).toBeCloseTo(independentFixture.planet.vector.x, 10);
    expect(sun.vector!.y).toBeCloseTo(independentFixture.planet.vector.y, 10);
    expect(sun.vector!.z).toBeCloseTo(independentFixture.planet.vector.z, 10);
  });

  it.each<unknown[]>([
    [...placements, { ...placements[0] }],
    placements.map(item => item.key === 'sun' ? { ...item, degreeInSign: 29 } : item),
    placements.map(item => item.key === 'sun' ? { ...item, sign: 'aries', signLabel: 'Aries' } : item),
    placements.map(item => item.key === 'sun' ? { ...item, glyph: null } : item),
    placements.map(item => item.key === 'sun' ? { ...item, label: 'Moon', glyph: '☽' } : item),
    placements.map(item => item.key === 'sun' ? { ...item, unexpected: 'reject me' } : item),
  ].map(badPlacements => [badPlacements]))('fails closed for duplicate or internally inconsistent saved placements %#', async (badPlacements) => {
    await expect(buildNatalNavigator({ ...row, natal_positions: { planets: badPlacements } })).rejects.toBeInstanceOf(NavigatorCalculationError);
  });

  it('fails the entire payload closed when a required body calculation fails', async () => {
    const fakeEph = {
      swe_calc_ut: (_jd: number, body: number) => body === Constants.SE_MARS
        ? { returnCode: -1, xx: new Float64Array(6), error: 'failure details' }
        : { returnCode: NAVIGATOR_FLAGS, xx: new Float64Array([1, 1, 1, 0, 0, 0]), error: '' },
    };
    await expect(buildNatalNavigator(row, { getEph: async () => fakeEph as any })).rejects.toMatchObject({ code: 'NAVIGATOR_CALCULATION_FAILED' });
  });

  it('omits only an unavailable optional coordinate while preserving all primary bodies', async () => {
    const fakeEph = {
      swe_calc_ut: (_jd: number, body: number) => body === Constants.SE_CHIRON
        ? { returnCode: -1, xx: new Float64Array(6), error: 'private engine detail' }
        : { returnCode: NAVIGATOR_FLAGS, xx: new Float64Array([1, 2, 3, 0, 0, 0]), error: '' },
    };
    const payload = await buildNatalNavigator(row, { getEph: async () => fakeEph as any });
    expect(payload.bodies.filter(body => body.category === 'primary')).toHaveLength(10);
    const unavailableChiron = payload.bodies.find(body => body.key === 'chiron');
    expect(unavailableChiron).toEqual({
      key: 'chiron', label: 'Chiron', glyph: '⚷', category: 'additional', status: 'unavailable',
      reason: 'ephemeris-unavailable', source: 'swiss-ephemeris',
    });
    expect(payload.availability.optionalUnavailable).toContain('chiron');
    expect(JSON.stringify(payload)).not.toContain('private engine detail');
  });

  it.each([
    new Float64Array([0, 0, 0, 0, 0, 0]),
    new Float64Array([NaN, 1, 1, 0, 0, 0]),
    new Float64Array([Infinity, 1, 1, 0, 0, 0]),
  ])('rejects invalid required Swiss vectors %#', async (xx) => {
    const fakeEph = { swe_calc_ut: () => ({ returnCode: NAVIGATOR_FLAGS, xx, error: '' }) };
    await expect(buildNatalNavigator(row, { getEph: async () => fakeEph as any })).rejects.toBeInstanceOf(NavigatorCalculationError);
  });
});
