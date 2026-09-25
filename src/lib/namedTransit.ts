import { Constants } from '@fusionstrings/swiss-eph';
import { computeChart, geocodeLocation, getEph, normDeg, PLANET_BODIES } from '@/lib/chartEngine';
import { angularDistance } from '@/lib/transit';

export const NAMED_TRANSIT_CONTRACT_VERSION = 'named-transit.v1';
export const NAMED_TRANSIT_EXPERIMENT_ID = 'R-016-saturn-square-natal-moon';
const SATURN = PLANET_BODIES.find((body) => body.key === 'saturn');
const SCAN_STEP_HOURS = 6;
const ORB_DEGREES = 1;
const EXACT_DETECTION_TOLERANCE_DEGREES = 0.05;
const DEDUPLICATION_TOLERANCE_SECONDS = 60;
const STATIONARY_SPEED_DEGREES_PER_DAY = 0.01;
const MAX_WINDOW_DAYS = 366;
const ROOT_ITERATIONS = 40;

type NamedTransitMotion = 'direct' | 'retrograde' | 'stationary' | 'indeterminate';
export type NamedTransitStatus = 'ready' | 'no-hit';
export type NamedTransitDirection = 'applying' | 'separating' | 'stationary' | 'indeterminate';

export interface NamedTransitBirthInput {
  date: string;
  time?: string;
  location: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  unknownTime?: boolean;
}

export interface NamedTransitRequest extends NamedTransitBirthInput {
  fromDate: string;
  windowDays?: number;
}

export interface NamedTransitWindow {
  id: string;
  startUtc: string;
  exactUtc: string;
  endUtc: string;
  direction: NamedTransitDirection;
  motion: NamedTransitMotion;
  minimumOrbDegrees: number;
  precisionSeconds: number;
}

export interface NamedTransitResult {
  contractVersion: string;
  experimentId: string;
  status: NamedTransitStatus;
  transit: { body: 'saturn'; label: 'Saturn'; aspect: 'square'; target: 'moon'; targetLabel: 'Natal Moon' };
  birth: { date: string; time: string; location: string; timezone: string; unknownTime: false };
  calculation: {
    fromUtc: string;
    toUtc: string;
    orbDegrees: number;
    scanStepHours: number;
    stationarySpeedDegreesPerDay: number;
    ephemeris: 'swiss-ephemeris';
  };
  windows: NamedTransitWindow[];
  explanation: string;
}

class NamedTransitInputError extends Error {}
class NamedTransitCalculationError extends Error {}

interface TransitSample {
  date: Date;
  error: number;
  signedOffset: number;
  speed: number;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new NamedTransitInputError('fromDate must be an ISO date');
  return date;
}

function isoSecond(date: Date): string {
  return new Date(Math.round(date.getTime() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

function clampWindowDays(value: number | undefined): number {
  const days = value ?? 366;
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    throw new NamedTransitInputError(`windowDays must be an integer from 1 to ${MAX_WINDOW_DAYS}`);
  }
  return days;
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateBirthInput(input: NamedTransitRequest): void {
  if (!isIsoDate(input.date)) throw new NamedTransitInputError('date must be a valid ISO date');
  if (!input.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw new NamedTransitInputError('known birth time is required in HH:mm format');
  }
  if (!input.location?.trim()) throw new NamedTransitInputError('location is required');
  if (!isIsoDate(input.fromDate)) throw new NamedTransitInputError('fromDate must be a valid ISO date');
  if (input.unknownTime) throw new NamedTransitInputError('named transit windows require a known birth time');

  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;
  const hasTimezone = input.timezone !== undefined;
  const suppliedAuthorityFields = Number(hasLatitude) + Number(hasLongitude) + Number(hasTimezone);
  if (suppliedAuthorityFields > 0 && suppliedAuthorityFields !== 3) {
    throw new NamedTransitInputError('latitude, longitude, and timezone must be supplied together');
  }
  if (hasLatitude && !Number.isFinite(input.latitude)) throw new NamedTransitInputError('latitude must be finite');
  if (hasLongitude && !Number.isFinite(input.longitude)) throw new NamedTransitInputError('longitude must be finite');
  if (hasLatitude && Math.abs(input.latitude!) > 90) throw new NamedTransitInputError('latitude must be between -90 and 90');
  if (hasLongitude && Math.abs(input.longitude!) > 180) throw new NamedTransitInputError('longitude must be between -180 and 180');
  if (hasTimezone && !validTimezone(input.timezone!)) throw new NamedTransitInputError('timezone must be a valid IANA timezone');
}

function saturnLongitudeAt(date: Date): Promise<{ longitude: number; speed: number }> {
  if (!SATURN) throw new NamedTransitCalculationError('Saturn is unavailable in the ephemeris body allowlist');
  return getEph().then((eph) => {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const flags = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL | Constants.SEFLG_SPEED;
    const result = eph.swe_calc_ut(jd, SATURN.se, flags);
    if (result.returnCode < 0 || !Array.from(result.xx).every(Number.isFinite)) {
      throw new NamedTransitCalculationError('Saturn ephemeris response was unavailable or non-finite');
    }
    return { longitude: normDeg(result.xx[0]), speed: result.xx[3] };
  });
}

function signedDistanceToCenter(longitude: number, center: number): number {
  return ((longitude - center + 540) % 360) - 180;
}

function signedSquareOffset(saturnLongitude: number, moonLongitude: number): number {
  const centers = [normDeg(moonLongitude + 90), normDeg(moonLongitude - 90)];
  const first = signedDistanceToCenter(saturnLongitude, centers[0]);
  const second = signedDistanceToCenter(saturnLongitude, centers[1]);
  return Math.abs(first) <= Math.abs(second) ? first : second;
}

function squareError(saturnLongitude: number, moonLongitude: number): number {
  return Math.abs(angularDistance(saturnLongitude, moonLongitude) - 90);
}

async function evaluateAt(date: Date, moonLongitude: number): Promise<TransitSample> {
  const saturn = await saturnLongitudeAt(date);
  const error = squareError(saturn.longitude, moonLongitude);
  const signedOffset = signedSquareOffset(saturn.longitude, moonLongitude);
  if (![error, signedOffset, saturn.speed].every(Number.isFinite)) {
    throw new NamedTransitCalculationError('Named transit motion was non-finite');
  }
  return { date, error, signedOffset, speed: saturn.speed };
}

async function refineBoundary(low: Date, high: Date, moonLongitude: number, activeAtHigh: boolean): Promise<Date> {
  let left = low.getTime();
  let right = high.getTime();
  for (let i = 0; i < ROOT_ITERATIONS; i += 1) {
    const middle = (left + right) / 2;
    const active = (await evaluateAt(new Date(middle), moonLongitude)).error <= ORB_DEGREES;
    if (active === activeAtHigh) right = middle;
    else left = middle;
  }
  return new Date((left + right) / 2);
}

async function refineExactCrossing(low: Date, high: Date, moonLongitude: number): Promise<Date> {
  let left = low.getTime();
  let right = high.getTime();
  let leftValue = (await evaluateAt(new Date(left), moonLongitude)).signedOffset;
  for (let i = 0; i < ROOT_ITERATIONS; i += 1) {
    const middle = (left + right) / 2;
    const middleValue = (await evaluateAt(new Date(middle), moonLongitude)).signedOffset;
    if (middleValue === 0) return new Date(middle);
    if (Math.sign(leftValue) === Math.sign(middleValue)) {
      left = middle;
      leftValue = middleValue;
    } else {
      right = middle;
    }
  }
  return new Date((left + right) / 2);
}

async function refineMinimum(low: Date, high: Date, moonLongitude: number): Promise<Date> {
  let left = low.getTime();
  let right = high.getTime();
  for (let i = 0; i < ROOT_ITERATIONS; i += 1) {
    const oneThird = left + (right - left) / 3;
    const twoThirds = right - (right - left) / 3;
    const [one, two] = await Promise.all([
      evaluateAt(new Date(oneThird), moonLongitude),
      evaluateAt(new Date(twoThirds), moonLongitude),
    ]);
    if (one.error <= two.error) right = twoThirds;
    else left = oneThird;
  }
  return new Date((left + right) / 2);
}

function motionForSpeed(speed: number): NamedTransitMotion {
  if (!Number.isFinite(speed)) return 'indeterminate';
  if (Math.abs(speed) <= STATIONARY_SPEED_DEGREES_PER_DAY) return 'stationary';
  return speed > 0 ? 'direct' : 'retrograde';
}

async function classifyDirection(exact: Date, moonLongitude: number): Promise<{ direction: NamedTransitDirection; motion: NamedTransitMotion }> {
  const exactSample = await evaluateAt(exact, moonLongitude);
  const motion = motionForSpeed(exactSample.speed);
  if (motion === 'indeterminate') return { direction: 'indeterminate', motion };
  if (motion === 'stationary') return { direction: 'stationary', motion };

  // Direction is the signed aspect-phase slope through the exact hit. This
  // avoids mistaking symmetric orb error around an ordinary crossing for a
  // stationary planet. The speed-derived motion remains separately exposed.
  const before = await evaluateAt(new Date(exact.getTime() - 6 * 60 * 60 * 1000), moonLongitude);
  const after = await evaluateAt(new Date(exact.getTime() + 6 * 60 * 60 * 1000), moonLongitude);
  const slope = after.signedOffset - before.signedOffset;
  if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) return { direction: 'indeterminate', motion };
  return { direction: slope > 0 ? 'applying' : 'separating', motion };
}

async function exactCandidates(group: { first: number; last: number }, samples: TransitSample[], moonLongitude: number): Promise<Date[]> {
  const candidates: Date[] = [];
  for (let i = group.first; i < group.last; i += 1) {
    const current = samples[i];
    const next = samples[i + 1];
    if (current.signedOffset === 0) candidates.push(current.date);
    if (current.signedOffset * next.signedOffset < 0) {
      candidates.push(await refineExactCrossing(current.date, next.date, moonLongitude));
    }
  }
  if (samples[group.last].signedOffset === 0) candidates.push(samples[group.last].date);

  // A stationary/tangent hit may touch exactitude without changing sign.
  for (let i = group.first; i <= group.last; i += 1) {
    const current = samples[i];
    const previous = i > group.first ? samples[i - 1] : null;
    const next = i < group.last ? samples[i + 1] : null;
    const isLocalMinimum = (!previous || current.error <= previous.error) && (!next || current.error <= next.error);
    if (isLocalMinimum && current.error <= EXACT_DETECTION_TOLERANCE_DEGREES) {
      const low = previous?.date ?? new Date(current.date.getTime() - SCAN_STEP_HOURS * 3600000);
      const high = next?.date ?? new Date(current.date.getTime() + SCAN_STEP_HOURS * 3600000);
      candidates.push(await refineMinimum(low, high, moonLongitude));
    }
  }
  return candidates.sort((a, b) => a.getTime() - b.getTime()).filter((candidate, index, all) => (
    index === 0 || candidate.getTime() - all[index - 1].getTime() > DEDUPLICATION_TOLERANCE_SECONDS * 1000
  ));
}

export async function calculateNamedTransit(input: NamedTransitRequest): Promise<NamedTransitResult> {
  validateBirthInput(input);
  const windowDays = clampWindowDays(input.windowDays);
  const resolved = input.latitude !== undefined && input.longitude !== undefined && input.timezone !== undefined
    ? { lat: input.latitude, lon: input.longitude, timezone: input.timezone }
    : await geocodeLocation(input.location);
  if (!resolved) throw new NamedTransitInputError('location could not be resolved to latitude, longitude, and timezone');

  const chart = await computeChart({
    date: input.date,
    time: input.time,
    location: input.location,
    timezone: resolved.timezone,
    latitude: resolved.lat,
    longitude: resolved.lon,
    unknownTime: false,
    requireAllBodies: true,
  });
  const moonLongitude = chart.moon.longitude;
  if (!Number.isFinite(moonLongitude)) throw new NamedTransitCalculationError('Natal Moon longitude is unavailable');

  const from = toUtcDate(input.fromDate);
  const to = new Date(from.getTime() + windowDays * 86400000);
  const samples: TransitSample[] = [];
  for (let time = from.getTime(); time <= to.getTime(); time += SCAN_STEP_HOURS * 3600000) {
    samples.push(await evaluateAt(new Date(time), moonLongitude));
  }

  const groups: Array<{ first: number; last: number }> = [];
  let current: { first: number; last: number } | null = null;
  samples.forEach((sample, index) => {
    if (sample.error <= ORB_DEGREES) {
      if (!current) current = { first: index, last: index };
      else current.last = index;
    } else if (current) {
      groups.push(current);
      current = null;
    }
  });
  if (current) groups.push(current);

  const windows: NamedTransitWindow[] = [];
  for (const group of groups) {
    const first = samples[group.first];
    const last = samples[group.last];
    const leftOutside = group.first > 0 ? samples[group.first - 1].date : from;
    const rightOutside = group.last < samples.length - 1 ? samples[group.last + 1].date : to;
    const start = group.first > 0 ? await refineBoundary(leftOutside, first.date, moonLongitude, true) : first.date;
    const end = group.last < samples.length - 1 ? await refineBoundary(last.date, rightOutside, moonLongitude, false) : last.date;
    const candidates = await exactCandidates(group, samples, moonLongitude);
    for (const exact of candidates) {
      const exactSample = await evaluateAt(exact, moonLongitude);
      const classified = await classifyDirection(exact, moonLongitude);
      const exactUtc = isoSecond(exact);
      windows.push({
        id: `${NAMED_TRANSIT_EXPERIMENT_ID}:${exactUtc}`,
        startUtc: isoSecond(start),
        exactUtc,
        endUtc: isoSecond(end),
        direction: classified.direction,
        motion: classified.motion,
        minimumOrbDegrees: +exactSample.error.toFixed(6),
        precisionSeconds: 1,
      });
    }
  }

  windows.sort((a, b) => a.exactUtc.localeCompare(b.exactUtc));
  return {
    contractVersion: NAMED_TRANSIT_CONTRACT_VERSION,
    experimentId: NAMED_TRANSIT_EXPERIMENT_ID,
    status: windows.length ? 'ready' : 'no-hit',
    transit: { body: 'saturn', label: 'Saturn', aspect: 'square', target: 'moon', targetLabel: 'Natal Moon' },
    birth: { date: input.date, time: input.time!, location: input.location, timezone: resolved.timezone, unknownTime: false },
    calculation: {
      fromUtc: from.toISOString(),
      toUtc: to.toISOString(),
      orbDegrees: ORB_DEGREES,
      scanStepHours: SCAN_STEP_HOURS,
      stationarySpeedDegreesPerDay: STATIONARY_SPEED_DEGREES_PER_DAY,
      ephemeris: 'swiss-ephemeris',
    },
    windows,
    explanation: windows.length
      ? 'These are deterministic Saturn-to-natal-Moon square windows. Dates are UTC calculation facts; display them in the saved IANA timezone.'
      : 'No Saturn square to the natal Moon was found within the requested window under the current one-degree orb policy.',
  };
}

export function isNamedTransitInputError(error: unknown): boolean {
  return error instanceof NamedTransitInputError;
}

export function isNamedTransitCalculationError(error: unknown): boolean {
  return error instanceof NamedTransitCalculationError;
}
