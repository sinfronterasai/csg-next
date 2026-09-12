export const VECTOR_UNIT_TOLERANCE = 1e-12;

/**
 * Shared metadata for every verified Cosmic Navigator coordinate.
 * `epoch` is added at the calculation boundary because it is the birth instant.
 */
export const NAVIGATOR_FRAME_BASE = {
  reference: 'ICRS',
  coordinateType: 'geocentric-equatorial',
  origin: 'geocenter',
  positionType: 'astrometric',
  convention: 'scene-y-up:x=cos(dec)*cos(ra),y=sin(dec),z=-cos(dec)*sin(ra)',
  axisEpoch: 'J2000.0',
  precession: 'none-fixed-ICRS-axes',
  nutation: 'omitted',
  annualAberration: 'omitted',
  solarDeflection: 'omitted',
  lightTime: 'retained',
  swissFlags: 138850,
} as const;

export type NavigatorFrame = typeof NAVIGATOR_FRAME_BASE & { epoch: string };
export type RaDec = { rightAscensionDeg: number; declinationDeg: number };
export type SceneVector = { x: number; y: number; z: number };

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MAS_TO_RAD = DEG_TO_RAD / 3_600_000;
const ARCSEC_TO_RAD = DEG_TO_RAD / 3600;

function requireFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function requireDeclination(declinationDeg: number): void {
  requireFinite(declinationDeg, 'Declination');
  if (declinationDeg < -90 || declinationDeg > 90) {
    throw new RangeError('Declination must be within [-90, 90] degrees');
  }
}

function requireJulianEpoch(epoch: number, label: string): void {
  requireFinite(epoch, label);
  if (epoch < -10_000 || epoch > 10_000) throw new RangeError(`${label} is outside the supported range`);
}

export function normalizeRightAscension(rightAscensionDeg: number): number {
  requireFinite(rightAscensionDeg, 'Right ascension');
  const wrapped = rightAscensionDeg % 360;
  const normalized = wrapped < 0 ? wrapped + 360 : wrapped;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function normalizeSceneVector(x: number, y: number, z: number): SceneVector {
  requireFinite(x, 'Cartesian x');
  requireFinite(y, 'Cartesian y');
  requireFinite(z, 'Cartesian z');
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) throw new RangeError('Cartesian vector must be non-zero and finite');
  return { x: x / length, y: y / length, z: z / length };
}

/** Convert RA/Dec to the Three.js y-up scene convention. */
export function raDecToSceneVector(rightAscensionDeg: number, declinationDeg: number): SceneVector {
  const ra = normalizeRightAscension(rightAscensionDeg) * DEG_TO_RAD;
  requireDeclination(declinationDeg);
  if (declinationDeg === 90) return { x: 0, y: 1, z: 0 };
  if (declinationDeg === -90) return { x: 0, y: -1, z: 0 };
  const dec = declinationDeg * DEG_TO_RAD;
  const cosDec = Math.cos(dec);
  return normalizeSceneVector(cosDec * Math.cos(ra), Math.sin(dec), -cosDec * Math.sin(ra));
}

/**
 * Swiss equatorial XYZ is conventional: +x=RA 0h, +y=RA 6h, +z=north.
 * The scene is y-up, so (x,y,z)_eq becomes (x,z,-y)_scene.
 */
export function equatorialCartesianToSceneVector(x: number, y: number, z: number): SceneVector {
  return normalizeSceneVector(x, z, -y);
}

export function cartesianEquatorialToRaDec(x: number, y: number, z: number): RaDec {
  requireFinite(x, 'Equatorial x');
  requireFinite(y, 'Equatorial y');
  requireFinite(z, 'Equatorial z');
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length === 0) throw new RangeError('Equatorial vector must be non-zero and finite');
  return {
    rightAscensionDeg: normalizeRightAscension(Math.atan2(y, x) * RAD_TO_DEG),
    declinationDeg: Math.asin(Math.max(-1, Math.min(1, z / length))) * RAD_TO_DEG,
  };
}

export function julianDayToJulianEpoch(julianDay: number): number {
  requireFinite(julianDay, 'Julian day');
  return 2000 + (julianDay - 2451545) / 365.25;
}

export type ProperMotionInput = RaDec & {
  properMotionRaMasPerYear: number;
  properMotionDecMasPerYear: number;
  fromJulianEpoch: number;
  toJulianEpoch: number;
};

/**
 * Propagate ICRS catalog motion in its tangent plane. Hipparcos pmRA is
 * mu-alpha-star (dRA/dt multiplied by cos(dec)), not raw dRA/dt.
 */
export function propagateProperMotion(input: ProperMotionInput): RaDec {
  const ra = normalizeRightAscension(input.rightAscensionDeg) * DEG_TO_RAD;
  requireDeclination(input.declinationDeg);
  requireFinite(input.properMotionRaMasPerYear, 'RA proper motion');
  requireFinite(input.properMotionDecMasPerYear, 'Dec proper motion');
  requireJulianEpoch(input.fromJulianEpoch, 'Source Julian epoch');
  requireJulianEpoch(input.toJulianEpoch, 'Target Julian epoch');

  const dec = input.declinationDeg * DEG_TO_RAD;
  const elapsedYears = input.toJulianEpoch - input.fromJulianEpoch;
  const cosRa = Math.cos(ra);
  const sinRa = Math.sin(ra);
  const cosDec = Math.cos(dec);
  const sinDec = Math.sin(dec);
  const base = { x: cosDec * cosRa, y: cosDec * sinRa, z: sinDec };
  const muRa = input.properMotionRaMasPerYear * MAS_TO_RAD * elapsedYears;
  const muDec = input.properMotionDecMasPerYear * MAS_TO_RAD * elapsedYears;
  const moved = {
    x: base.x + muRa * -sinRa + muDec * -sinDec * cosRa,
    y: base.y + muRa * cosRa + muDec * -sinDec * sinRa,
    z: base.z + muDec * cosDec,
  };
  return cartesianEquatorialToRaDec(moved.x, moved.y, moved.z);
}

export type MeanPrecessionInput = RaDec & {
  fromJulianEpoch: number;
  toJulianEpoch: number;
};

/** IAU 1976 general precession, returning mean equator/equinox of target date. */
export function precessMeanEquatorial(input: MeanPrecessionInput): RaDec {
  const ra = normalizeRightAscension(input.rightAscensionDeg) * DEG_TO_RAD;
  requireDeclination(input.declinationDeg);
  requireJulianEpoch(input.fromJulianEpoch, 'Source equinox');
  requireJulianEpoch(input.toJulianEpoch, 'Target equinox');
  if (input.fromJulianEpoch === input.toJulianEpoch) {
    return { rightAscensionDeg: normalizeRightAscension(input.rightAscensionDeg), declinationDeg: input.declinationDeg };
  }

  const dec = input.declinationDeg * DEG_TO_RAD;
  const T = (input.fromJulianEpoch - 2000) / 100;
  const t = (input.toJulianEpoch - input.fromJulianEpoch) / 100;
  const zeta = ((2306.2181 + 1.39656 * T - 0.000139 * T * T) * t +
    (0.30188 - 0.000344 * T) * t * t + 0.017998 * t * t * t) * ARCSEC_TO_RAD;
  const z = ((2306.2181 + 1.39656 * T - 0.000139 * T * T) * t +
    (1.09468 + 0.000066 * T) * t * t + 0.018203 * t * t * t) * ARCSEC_TO_RAD;
  const theta = ((2004.3109 - 0.85330 * T - 0.000217 * T * T) * t -
    (0.42665 + 0.000217 * T) * t * t - 0.041833 * t * t * t) * ARCSEC_TO_RAD;

  const A = Math.cos(dec) * Math.sin(ra + zeta);
  const B = Math.cos(theta) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(theta) * Math.sin(dec);
  const C = Math.sin(theta) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(theta) * Math.sin(dec);
  return {
    rightAscensionDeg: normalizeRightAscension((Math.atan2(A, B) + z) * RAD_TO_DEG),
    declinationDeg: Math.asin(Math.max(-1, Math.min(1, C))) * RAD_TO_DEG,
  };
}

export function assertMatchingFrames(
  expected: NavigatorFrame,
  actual: Partial<Record<keyof NavigatorFrame, unknown>>,
): void {
  for (const key of [...Object.keys(NAVIGATOR_FRAME_BASE), 'epoch'] as Array<keyof NavigatorFrame>) {
    if (expected[key] !== actual[key]) throw new RangeError(`Coordinate frame ${String(key)} mismatch`);
  }
}
