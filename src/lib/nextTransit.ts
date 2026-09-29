import { computeChart, geocodeLocation } from '@/lib/chartEngine';
import { compareImportance } from './yearlyTransit/scoring';
import { compileYearlyTransit } from './yearlyTransit/compiler';
import type { ActiveWindow, AspectType, MovingBody, NatalTarget, TransitDirection, YearlyTransitFactPack } from './yearlyTransit/types';

export const NEXT_TRANSIT_CONTRACT_VERSION = 'next-major-transit.v1';
export const NEXT_TRANSIT_EXPERIMENT_ID = 'GATE25R-next-major-transit-v2-4';
const MAJOR_THRESHOLD = 75;
const SIGNIFICANT_THRESHOLD = 60;

export interface NextTransitRequest {
  date: string;
  time: string;
  location: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  unknownTime?: boolean;
  fromDate?: string;
  movingPlanet?: string;
  target?: string;
  aspect?: string;
}

export interface NextTransitDto {
  mover: MovingBody;
  moverLabel: string;
  aspect: AspectType;
  target: NatalTarget;
  targetLabel: string;
  status: 'ACTIVE' | 'UPCOMING';
  activeWindow: { startUtc: string; endUtc: string };
  strongestDate: string;
  primaryPhase: TransitDirection;
  shortInterpretation: string;
}

export interface NextTransitResult {
  nextTransit: NextTransitDto | null;
  significantTransitCount: number;
  searchPeriod: { fromUtc: string; toUtc: string; displayTimezone: string };
  contractVersion: typeof NEXT_TRANSIT_CONTRACT_VERSION;
}

export class NextTransitInputError extends Error {}
export class NextTransitCalculationError extends Error {}

function label(value: string): string {
  if (value === 'asc') return 'Ascendant';
  if (value === 'mc') return 'Midheaven';
  if (value === 'northnode') return 'North Node';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}

function validateRequest(input: NextTransitRequest): void {
  if (!validIsoDate(input.date)) throw new NextTransitInputError('date must be a valid ISO date');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new NextTransitInputError('known birth time is required in HH:mm format');
  if (!input.location?.trim()) throw new NextTransitInputError('location is required');
  if (input.unknownTime) throw new NextTransitInputError('a known birth time is required');
  if (input.fromDate !== undefined) throw new NextTransitInputError('fromDate is not accepted for next-major-transit');
  if (input.movingPlanet || input.target || input.aspect) throw new NextTransitInputError('moving planet, natal target, and aspect are selected by the deterministic contract');
  const supplied = [input.latitude, input.longitude, input.timezone].filter((value) => value !== undefined).length;
  if (supplied !== 0 && supplied !== 3) throw new NextTransitInputError('latitude, longitude, and timezone must be supplied together');
  if (input.latitude !== undefined && (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90)) throw new NextTransitInputError('latitude must be finite and between -90 and 90');
  if (input.longitude !== undefined && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) throw new NextTransitInputError('longitude must be finite and between -180 and 180');
  if (input.timezone !== undefined && !validTimezone(input.timezone)) throw new NextTransitInputError('timezone must be a valid IANA timezone');
}

function strongestDate(window: ActiveWindow): string {
  const exact = [...window.exactHits].sort((a, b) => a.exactError - b.exactError || a.exactUtc.localeCompare(b.exactUtc))[0];
  if (exact) return exact.exactUtc;
  return new Date((Date.parse(window.activeWindow.startUtc) + Date.parse(window.activeWindow.endUtc)) / 2).toISOString();
}

function interpretation(window: ActiveWindow): string {
  const mover = label(window.mover);
  const target = label(window.target);
  const aspect = window.aspectType === 'trine' || window.aspectType === 'sextile' ? 'supports' : window.aspectType === 'square' || window.aspectType === 'opposition' ? 'asks for adjustment in' : 'intensifies';
  return `${mover} ${aspect} your natal ${target}. Notice what is becoming more important, and make one grounded choice that reflects the pattern rather than treating it as a fixed prediction.`;
}

function toDto(window: ActiveWindow, nowUtc: string): NextTransitDto {
  const start = Date.parse(window.activeWindow.startUtc);
  const end = Date.parse(window.activeWindow.endUtc);
  const now = Date.parse(nowUtc);
  const exact = [...window.exactHits].sort((a, b) => a.exactUtc.localeCompare(b.exactUtc))[0];
  return {
    mover: window.mover,
    moverLabel: label(window.mover),
    aspect: window.aspectType,
    target: window.target,
    targetLabel: label(window.target),
    status: now >= start && now <= end ? 'ACTIVE' : 'UPCOMING',
    activeWindow: { ...window.activeWindow },
    strongestDate: strongestDate(window),
    primaryPhase: exact?.direction ?? window.segments[0]?.direction ?? 'indeterminate',
    shortInterpretation: interpretation(window),
  };
}

export function selectNextMajorTransit(pack: YearlyTransitFactPack, nowUtc = new Date().toISOString()): NextTransitResult {
  const major = pack.windows.filter((window) => window.importanceScore >= MAJOR_THRESHOLD);
  const now = Date.parse(nowUtc);
  if (!Number.isFinite(now)) throw new NextTransitInputError('nowUtc must be a valid ISO timestamp');
  const active = major.filter((window) => Date.parse(window.activeWindow.startUtc) <= now && now <= Date.parse(window.activeWindow.endUtc));
  const activeWinner = [...active].sort(compareImportance)[0];
  const future = major.filter((window) => Date.parse(window.activeWindow.startUtc) > now);
  const firstStart = future.length ? Math.min(...future.map((window) => Date.parse(window.activeWindow.startUtc))) : null;
  const futureWinner = firstStart === null ? undefined : future.filter((window) => Date.parse(window.activeWindow.startUtc) === firstStart).sort(compareImportance)[0];
  const selected = activeWinner ?? futureWinner;
  return {
    nextTransit: selected ? toDto(selected, nowUtc) : null,
    significantTransitCount: pack.windows.filter((window) => window.importanceScore >= SIGNIFICANT_THRESHOLD).length,
    searchPeriod: { fromUtc: pack.period.fromUtc, toUtc: pack.period.toUtc, displayTimezone: pack.displayTimezone },
    contractVersion: NEXT_TRANSIT_CONTRACT_VERSION,
  };
}

export async function calculateNextTransit(input: NextTransitRequest, nowUtc = new Date().toISOString()): Promise<NextTransitResult> {
  validateRequest(input);
  const resolved = input.latitude !== undefined && input.longitude !== undefined && input.timezone !== undefined
    ? { lat: input.latitude, lon: input.longitude, timezone: input.timezone }
    : await geocodeLocation(input.location);
  if (!resolved) throw new NextTransitInputError('location could not be resolved to latitude, longitude, and timezone');
  try {
    const chart = await computeChart({ date: input.date, time: input.time, location: input.location, timezone: resolved.timezone, latitude: resolved.lat, longitude: resolved.lon, unknownTime: false, requireAllBodies: true });
    const fromDate = nowUtc.slice(0, 10);
    const snapshot = {
      snapshotId: `${NEXT_TRANSIT_EXPERIMENT_ID}:${input.date}:${input.time}:${resolved.lat}:${resolved.lon}`,
      generatedAtUtc: nowUtc,
      birthData: { date: input.date, time: input.time, latitude: resolved.lat, longitude: resolved.lon, timezone: resolved.timezone },
    };
    const pack = await compileYearlyTransit({ chart, snapshot, fromDate });
    return selectNextMajorTransit(pack, nowUtc);
  } catch (error) {
    if (error instanceof NextTransitInputError) throw error;
    throw new NextTransitCalculationError(error instanceof Error ? error.message : 'next-major-transit calculation failed');
  }
}

export function isNextTransitInputError(error: unknown): boolean {
  return error instanceof NextTransitInputError;
}

export function isNextTransitCalculationError(error: unknown): boolean {
  return error instanceof NextTransitCalculationError;
}
