// F7-1: independent reference corpus tests.
//
// PRIMARY: production output is compared DIRECTLY to fixed expected constants checked
// into independentReferenceCorpus.ts (computed from Meeus 1998, an independent source,
// NOT the production Swiss Ephemeris engine). Expected values are NOT computed at test
// runtime.
//
// SECONDARY (clearly labeled): the Meeus implementation is recomputed at runtime as a
// cross-check only; it is not the authoritative expected corpus.

import { computeVerifiedCommon } from '@/lib/reportFacts/derived';
import { KNOWN_TIME_ORDINARY } from './fixtures/factsFixtures';
import {
  REFERENCE_INSTANT, SOURCE_METADATA, FIXED_EXPECTED, TOLERANCES,
} from './fixtures/independentReferenceCorpus';

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
function norm360(x: number): number { return ((x % 360) + 360) % 360; }
function angularDiff(a: number, b: number): number {
  const x = Math.abs(norm360(a) - norm360(b));
  return Math.min(x, 360 - x);
}
const signOf = (lon: number) => SIGNS[Math.floor(norm360(lon) / 30)];

describe('F7-1 — independent Meeus reference corpus (fixed constants)', () => {
  let eng: any;
  beforeAll(async () => { eng = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth); });
  const lon = (id: string) => eng.positions.find((p: any) => p.id === id).value.longitude;

  test('Sun longitude matches fixed independent reference within tolerance', () => {
    expect(angularDiff(lon('natal.sun.position'), FIXED_EXPECTED.sun.longitude)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.sun.position'))).toBe(FIXED_EXPECTED.sun.sign);
  });
  test('Moon longitude matches fixed independent reference within tolerance', () => {
    expect(angularDiff(lon('natal.moon.position'), FIXED_EXPECTED.moon.longitude)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.moon.position'))).toBe(FIXED_EXPECTED.moon.sign);
  });
  test('ASC longitude matches fixed independent reference within tolerance', () => {
    expect(angularDiff(lon('natal.ascendant.position'), FIXED_EXPECTED.ascendant.longitude)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.ascendant.position'))).toBe(FIXED_EXPECTED.ascendant.sign);
  });
  test('MC longitude matches fixed independent reference within tolerance', () => {
    expect(angularDiff(lon('natal.midheaven.position'), FIXED_EXPECTED.midheaven.longitude)).toBeLessThanOrEqual(TOLERANCES.bodyLongitude);
    expect(signOf(lon('natal.midheaven.position'))).toBe(FIXED_EXPECTED.midheaven.sign);
  });
  test('North Node within documented mean/true node spread and same sign', () => {
    const engNode = lon('natal.northnode.position');
    expect(angularDiff(engNode, FIXED_EXPECTED.northNodeMean.longitude)).toBeLessThanOrEqual(TOLERANCES.nodeLongitude);
    expect(signOf(engNode)).toBe(FIXED_EXPECTED.northNodeMean.sign);
  });
  test('Retrograde set equals the fixed independent determination', () => {
    const engRetro = eng.positions.filter((p: any) => p.value.retrograde).map((p: any) => p.value.key).sort();
    expect(engRetro).toEqual([...FIXED_EXPECTED.retrograde].sort());
  });

  test('reference metadata is recorded (UTC instant, coordinates, source, tolerances)', () => {
    expect(REFERENCE_INSTANT.utc).toBe('1990-06-15T10:00:00Z');
    expect(REFERENCE_INSTANT.location).toBe('Paris');
    expect(SOURCE_METADATA.product).toContain('Meeus');
    expect(SOURCE_METADATA.zodiac).toBe('tropical');
    expect(TOLERANCES.bodyLongitude).toBe(0.5);
  });
});

// SECONDARY cross-check only: Meeus recomputed at runtime (not the authoritative corpus).
describe('F7-1 secondary — Meeus runtime recomputation cross-check (not authoritative)', () => {
  const PARIS_LON = REFERENCE_INSTANT.lon, PARIS_LAT = REFERENCE_INSTANT.lat;
  function jdFromUTC(y: number, m: number, d: number, h: number, min: number): number {
    const frac = (h + min / 60) / 24;
    const a = Math.floor((14 - m) / 12);
    const yyy = y + 4800 - a;
    const mmm = m + 12 * a - 3;
    const jdn = d + Math.floor((153 * mmm + 2) / 5) + 365 * yyy + Math.floor(yyy / 4) - Math.floor(yyy / 100) + Math.floor(yyy / 400) - 32045;
    return jdn + frac - 0.5;
  }
  function sunM(jd: number): number {
    const n = jd - 2451545.0;
    const L = 280.46646 + n * 0.98564736;
    const g = (357.52911 + n * 0.98560028) * Math.PI / 180;
    return norm360(L + 1.914602 * Math.sin(g) + 0.019993 * Math.sin(2 * g) + 0.000289 * Math.sin(3 * g));
  }
  function moonM(jd: number): number {
    const d = jd - 2451545.0;
    const L0 = 218.3165 + 13.1763966 * d;
    const M = 134.963 + 13.064993 * d;
    const F = 93.272 + 13.229350 * d;
    const D = 297.85 + 12.19075 * d;
    const R = Math.PI / 180;
    return norm360(L0 + 6.2886 * Math.sin(M * R) + 1.2740 * Math.sin((2 * D - M) * R) + 0.6583 * Math.sin(2 * D * R) + 0.2136 * Math.sin((2 * D - 2 * M) * R) - 0.1851 * Math.sin(M * R) - 0.1143 * Math.sin(2 * F * R) + 0.0588 * Math.sin((2 * D - 2 * F) * R));
  }
  function gmst(jd: number): number {
    const T = (jd - 2451545.0) / 36525;
    return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - 0.000000002695 * T * T * T);
  }
  const jd = jdFromUTC(1990, 6, 15, 10, 0);
  const ramc = norm360(gmst(jd) + PARIS_LON);
  const eps = 23.4393;
  const ramcR = ramc * Math.PI / 180, epsR = eps * Math.PI / 180, latR = PARIS_LAT * Math.PI / 180;
  const mcInd = norm360(Math.atan2(Math.sin(ramcR), Math.cos(ramcR) * Math.cos(epsR)) * 180 / Math.PI);
  const ascY = Math.cos(ramcR);
  const ascX = -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(latR) * Math.sin(epsR));
  const ascInd = norm360(Math.atan2(ascY, ascX) * 180 / Math.PI);

  let eng2: any;
  beforeAll(async () => { eng2 = await computeVerifiedCommon(KNOWN_TIME_ORDINARY.birth); });
  const lon2 = (id: string) => eng2.positions.find((p: any) => p.id === id).value.longitude;

  test('Sun/Moon/ASC/MC within 0.5 deg of runtime Meeus (secondary)', () => {
    expect(angularDiff(lon2('natal.sun.position'), sunM(jd))).toBeLessThanOrEqual(0.5);
    expect(angularDiff(lon2('natal.moon.position'), moonM(jd))).toBeLessThanOrEqual(0.5);
    expect(angularDiff(lon2('natal.ascendant.position'), ascInd)).toBeLessThanOrEqual(0.5);
    expect(angularDiff(lon2('natal.midheaven.position'), mcInd)).toBeLessThanOrEqual(0.5);
  });
});
