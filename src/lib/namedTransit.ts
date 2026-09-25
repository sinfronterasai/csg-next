import { Constants } from '@fusionstrings/swiss-eph';
import { computeChart, geocodeCoordinates, geocodeLocation, getEph, normDeg, PLANET_BODIES } from '@/lib/chartEngine';
import { angularDistance } from '@/lib/transit';

export const NAMED_TRANSIT_CONTRACT_VERSION = 'named-transit.v1';
export const NAMED_TRANSIT_EXPERIMENT_ID = 'R-016-saturn-square-natal-moon';
const SATURN = PLANET_BODIES.find((body) => body.key === 'saturn');
const SCAN_STEP_HOURS = 6;
const ORB_DEGREES = 1;
const MAX_WINDOW_DAYS = 366;

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
    ephemeris: 'swiss-ephemeris';
  };
  windows: NamedTransitWindow[];
  explanation: string;
}

class NamedTransitInputError extends Error {}
class NamedTransitCalculationError extends Error {}

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

function validateBirthInput(input: NamedTransitRequest): void {
  if (!isIsoDate(input.date)) throw new NamedTransitInputError('date must be a valid ISO date');
  if (!input.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw new NamedTransitInputError('known birth time is required in HH:mm format');
  }
  if (!input.location?.trim()) throw new NamedTransitInputError('location is required');
  if (!isIsoDate(input.fromDate)) throw new NamedTransitInputError('fromDate must be a valid ISO date');
  if (input.latitude !== undefined && !Number.isFinite(input.latitude)) throw new NamedTransitInputError('latitude must be finite');
  if (input.longitude !== undefined && !Number.isFinite(input.longitude)) throw new NamedTransitInputError('longitude must be finite');
  if (input.latitude !== undefined && Math.abs(input.latitude) > 90) throw new NamedTransitInputError('latitude must be between -90 and 90');
  if (input.longitude !== undefined && Math.abs(input.longitude) > 180) throw new NamedTransitInputError('longitude must be between -180 and 180');
  if (input.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }); }
    catch { throw new NamedTransitInputError('timezone must be a valid IANA timezone'); }
  }
  if (input.unknownTime) throw new NamedTransitInputError('named transit windows require a known birth time');
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

function squareError(saturnLongitude: number, moonLongitude: number): number {
  return Math.abs(angularDistance(saturnLongitude, moonLongitude) - 90);
}

async function errorAt(date: Date, moonLongitude: number): Promise<number> {
  const saturn = await saturnLongitudeAt(date);
  return squareError(saturn.longitude, moonLongitude);
}

async function refineBoundary(low: Date, high: Date, moonLongitude: number, activeAtHigh: boolean): Promise<Date> {
  let left = low.getTime();
  let right = high.getTime();
  for (let i = 0; i < 30; i += 1) {
    const middle = (left + right) / 2;
    const active = (await errorAt(new Date(middle), moonLongitude)) <= ORB_DEGREES;
    if (active === activeAtHigh) right = middle;
    else left = middle;
  }
  return new Date((left + right) / 2);
}

async function refineMinimum(low: Date, high: Date, moonLongitude: number): Promise<Date> {
  let left = low.getTime();
  let right = high.getTime();
  for (let i = 0; i < 32; i += 1) {
    const oneThird = left + (right - left) / 3;
    const twoThirds = right - (right - left) / 3;
    const [oneError, twoError] = await Promise.all([
      errorAt(new Date(oneThird), moonLongitude),
      errorAt(new Date(twoThirds), moonLongitude),
    ]);
    if (oneError <= twoError) right = twoThirds;
    else left = oneThird;
  }
  return new Date((left + right) / 2);
}

async function directionAt(exact: Date, moonLongitude: number): Promise<NamedTransitDirection> {
  const before = new Date(exact.getTime() - 6 * 60 * 60 * 1000);
  const after = new Date(exact.getTime() + 6 * 60 * 60 * 1000);
  const [beforeError, exactError, afterError] = await Promise.all([
    errorAt(before, moonLongitude),
    errorAt(exact, moonLongitude),
    errorAt(after, moonLongitude),
  ]);
  if (![beforeError, exactError, afterError].every(Number.isFinite)) return 'indeterminate';
  if (Math.abs(beforeError - afterError) < 0.0001) return 'stationary';
  return beforeError > afterError ? 'applying' : 'separating';
}

export async function calculateNamedTransit(input: NamedTransitRequest): Promise<NamedTransitResult> {
  validateBirthInput(input);
  const windowDays = clampWindowDays(input.windowDays);
  const resolved = input.timezone
    ? { lat: input.latitude, lon: input.longitude, timezone: input.timezone }
    : input.latitude !== undefined && input.longitude !== undefined
      ? geocodeCoordinates(input.latitude, input.longitude)
      : await geocodeLocation(input.location);
  if (!resolved) throw new NamedTransitInputError('location could not be resolved to an IANA timezone');
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
  const samples: Array<{ date: Date; error: number }> = [];
  for (let time = from.getTime(); time <= to.getTime(); time += SCAN_STEP_HOURS * 3600000) {
    const date = new Date(time);
    const error = await errorAt(date, moonLongitude);
    if (!Number.isFinite(error)) throw new NamedTransitCalculationError('Named transit error was non-finite');
    samples.push({ date, error });
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
    const start = group.first > 0
      ? await refineBoundary(leftOutside, first.date, moonLongitude, true)
      : first.date;
    const end = group.last < samples.length - 1
      ? await refineBoundary(last.date, rightOutside, moonLongitude, false)
      : last.date;
    const exact = await refineMinimum(start, end, moonLongitude);
    const id = `${NAMED_TRANSIT_EXPERIMENT_ID}:${isoSecond(exact)}`;
    windows.push({
      id,
      startUtc: isoSecond(start),
      exactUtc: isoSecond(exact),
      endUtc: isoSecond(end),
      direction: await directionAt(exact, moonLongitude),
      minimumOrbDegrees: +(await errorAt(exact, moonLongitude)).toFixed(6),
      precisionSeconds: 1,
    });
  }

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
