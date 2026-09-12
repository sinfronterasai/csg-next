import {
  NAVIGATOR_FRAME_BASE,
  assertMatchingFrames,
  cartesianEquatorialToRaDec,
  equatorialCartesianToSceneVector,
  julianDayToJulianEpoch,
  normalizeRightAscension,
  precessMeanEquatorial,
  propagateProperMotion,
  raDecToSceneVector,
} from '@/lib/constellations/coordinates';

const J2000 = 2451545.0;

describe('Cosmic Navigator pure coordinate transforms', () => {
  it.each([
    [0, 0], [360, 0], [-360, 0], [361, 1], [-1, 359], [1080.25, 0.25],
  ])('wraps finite right ascension %p to [0, 360)', (input, expected) => {
    expect(normalizeRightAscension(input)).toBeCloseTo(expected, 14);
  });

  it('uses the documented y-up scene axes at negative declination and both poles', () => {
    const negative = raDecToSceneVector(0, -30);
    expect(negative.x).toBeCloseTo(Math.cos(Math.PI / 6), 14);
    expect(negative.y).toBeCloseTo(-0.5, 14);
    expect(negative.z).toBe(-0);
    expect(raDecToSceneVector(123, 90)).toEqual(expect.objectContaining({ x: 0, y: 1, z: 0 }));
    expect(raDecToSceneVector(321, -90)).toEqual(expect.objectContaining({ x: 0, y: -1, z: 0 }));
  });

  it('maps conventional equatorial Cartesian axes into the same normalized scene convention', () => {
    expect(equatorialCartesianToSceneVector(2, 0, 0)).toEqual({ x: 1, y: 0, z: -0 });
    expect(equatorialCartesianToSceneVector(0, 4, 0)).toEqual({ x: 0, y: 0, z: -1 });
    expect(equatorialCartesianToSceneVector(0, 0, 8)).toEqual({ x: 0, y: 1, z: -0 });
    const spherical = cartesianEquatorialToRaDec(0, -2, -2);
    expect(spherical.rightAscensionDeg).toBe(270);
    expect(spherical.declinationDeg).toBeCloseTo(-45, 13);
  });

  it('always returns a finite unit vector within calculation tolerance', () => {
    for (const [ra, dec] of [[0, 0], [90, -45], [359.999999, 89.999], [720.5, -89.999]] as const) {
      const vector = raDecToSceneVector(ra, dec);
      expect(Object.values(vector).every(Number.isFinite)).toBe(true);
      expect(Math.abs(Math.hypot(vector.x, vector.y, vector.z) - 1)).toBeLessThanOrEqual(1e-12);
    }
  });

  it.each([
    () => normalizeRightAscension(NaN),
    () => normalizeRightAscension(Infinity),
    () => raDecToSceneVector(0, 90.000001),
    () => raDecToSceneVector(0, -90.000001),
    () => raDecToSceneVector(NaN, 0),
    () => cartesianEquatorialToRaDec(0, 0, 0),
    () => equatorialCartesianToSceneVector(Infinity, 0, 0),
    () => julianDayToJulianEpoch(NaN),
  ])('rejects non-finite, out-of-range, or zero-vector input %#', (operation) => {
    expect(operation).toThrow(RangeError);
  });

  it('converts Julian day to Julian epoch without calendar rounding', () => {
    expect(julianDayToJulianEpoch(J2000)).toBe(2000);
    expect(julianDayToJulianEpoch(J2000 + 365.25 * 25.5)).toBe(2025.5);
  });

  it('propagates proper motion in the ICRS tangent plane without changing frame orientation', () => {
    const moved = propagateProperMotion({
      rightAscensionDeg: 90,
      declinationDeg: 0,
      properMotionRaMasPerYear: 206264806.24709636,
      properMotionDecMasPerYear: 206264806.24709636,
      fromJulianEpoch: 2000,
      toJulianEpoch: 2001,
    });
    // Tangent-vector propagation followed by normalization: (0,1,0)+(−1,0,1).
    expect(moved.rightAscensionDeg).toBeCloseTo(135, 12);
    expect(moved.declinationDeg).toBeCloseTo(35.264389682754654, 12);
  });

  it('matches an independent published IAU 1976 precession fixture', () => {
    // Meeus, Astronomical Algorithms (2nd ed.), Example 21.a, precession only.
    const result = precessMeanEquatorial({
      // The example first propagates proper motion to these J2000-oriented
      // coordinates, then applies precession exactly once.
      rightAscensionDeg: 41.0540625,
      declinationDeg: 49.22775,
      fromJulianEpoch: 2000,
      toJulianEpoch: 2028.867,
    });
    expect(result.rightAscensionDeg).toBeCloseTo(41.5472, 3);
    expect(result.declinationDeg).toBeCloseTo(49.3485, 3);
  });

  it('fails closed on frame or epoch mismatch', () => {
    const expected = { ...NAVIGATOR_FRAME_BASE, epoch: '2000-01-01T12:00:00.000Z' };
    expect(() => assertMatchingFrames(expected, { ...expected })).not.toThrow();
    expect(() => assertMatchingFrames(expected, { ...expected, epoch: '2000-01-02T12:00:00.000Z' })).toThrow(/epoch/i);
    expect(() => assertMatchingFrames(expected, { ...expected, reference: 'mean-equator-and-equinox-of-date' })).toThrow(/reference/i);
    expect(() => assertMatchingFrames(expected, { ...expected, convention: 'x-right-y-forward-z-up' })).toThrow(/convention/i);
  });
});
