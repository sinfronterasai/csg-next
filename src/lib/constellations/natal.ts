import { Constants, type SwissEph } from '@fusionstrings/swiss-eph';
import { getEph } from '@/lib/chartEngine';
import { getPlanet, signFromLongitude } from '@/lib/astrology';
import {
  assertMatchingFrames,
  cartesianEquatorialToRaDec,
  equatorialCartesianToSceneVector,
  NAVIGATOR_FRAME_BASE,
} from './coordinates';
import { getNamedStarsAtEpoch } from './starCatalog';

export const NAVIGATOR_SCHEMA_VERSION = 'csg-natal-navigator-v1' as const;
export const NAVIGATOR_FLAGS = Constants.SEFLG_SWIEPH |
  Constants.SEFLG_EQUATORIAL |
  Constants.SEFLG_XYZ |
  Constants.SEFLG_J2000 |
  Constants.SEFLG_NONUT |
  Constants.SEFLG_NOABERR |
  Constants.SEFLG_NOGDEFL |
  Constants.SEFLG_ICRS;

export const PRIMARY_BODY_KEYS = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
] as const;
export const ADDITIONAL_BODY_KEYS = ['chiron', 'juno', 'northnode'] as const;

const BODY_IDS: Record<string, number> = {
  sun: Constants.SE_SUN,
  moon: Constants.SE_MOON,
  mercury: Constants.SE_MERCURY,
  venus: Constants.SE_VENUS,
  mars: Constants.SE_MARS,
  jupiter: Constants.SE_JUPITER,
  saturn: Constants.SE_SATURN,
  uranus: Constants.SE_URANUS,
  neptune: Constants.SE_NEPTUNE,
  pluto: Constants.SE_PLUTO,
  chiron: Constants.SE_CHIRON,
  juno: Constants.SE_JUNO,
  northnode: Constants.SE_TRUE_NODE,
};

type NavigatorBodyBase = {
  key: string;
  label: string;
  glyph: string;
  category: 'primary' | 'additional';
  source: 'swiss-ephemeris';
};

export type NavigatorBodyAvailable = NavigatorBodyBase & {
  status: 'available';
  rightAscensionDeg: number;
  declinationDeg: number;
  vector: { x: number; y: number; z: number };
  longitude: number;
  sign: string;
  signLabel: string;
  degreeInSign: number;
  house: number | null;
  retrograde: boolean;
};

export type NavigatorBodyUnavailable = NavigatorBodyBase & {
  status: 'unavailable';
  reason: 'ephemeris-unavailable' | 'saved-placement-unavailable';
};

export type NavigatorBody = NavigatorBodyAvailable | NavigatorBodyUnavailable;

export type NatalNavigatorResponse = {
  schemaVersion: typeof NAVIGATOR_SCHEMA_VERSION;
  frame: typeof NAVIGATOR_FRAME_BASE & { epoch: string };
  birthAnchor: { utc: string; timezone: string; source: 'saved-natal-chart' };
  bodies: NavigatorBody[];
  namedStars: ReturnType<typeof getNamedStarsAtEpoch>;
  source: { engine: 'swiss-ephemeris'; package: '@fusionstrings/swiss-eph'; flags: number; calculationTime: 'UTC-derived Julian day supplied as tjd_ut' };
  availability: { primary: 'available'; optionalUnavailable: string[] };
};

export function validateNatalNavigatorResponse(value: unknown): value is NatalNavigatorResponse {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<NatalNavigatorResponse>;
  const utc = payload.birthAnchor?.utc;
  if (payload.schemaVersion !== NAVIGATOR_SCHEMA_VERSION || typeof utc !== 'string' ||
      !Number.isFinite(Date.parse(utc)) || new Date(Date.parse(utc)).toISOString() !== utc ||
      payload.birthAnchor?.source !== 'saved-natal-chart' || typeof payload.birthAnchor.timezone !== 'string' || !payload.birthAnchor.timezone ||
      payload.source?.engine !== 'swiss-ephemeris' || payload.source.package !== '@fusionstrings/swiss-eph' ||
      payload.source.flags !== NAVIGATOR_FLAGS || payload.source.calculationTime !== 'UTC-derived Julian day supplied as tjd_ut' ||
      payload.availability?.primary !== 'available' || !Array.isArray(payload.availability.optionalUnavailable) ||
      !Array.isArray(payload.bodies) || !Array.isArray(payload.namedStars)) return false;
  try { assertMatchingFrames({ ...NAVIGATOR_FRAME_BASE, epoch: utc }, payload.frame ?? {}); } catch { return false; }
  const allKeys = [...PRIMARY_BODY_KEYS, ...ADDITIONAL_BODY_KEYS];
  const availableKeys = ['category', 'declinationDeg', 'degreeInSign', 'glyph', 'house', 'key', 'label', 'longitude', 'retrograde', 'rightAscensionDeg', 'sign', 'signLabel', 'source', 'status', 'vector'];
  const unavailableKeys = ['category', 'glyph', 'key', 'label', 'reason', 'source', 'status'];
  if (payload.bodies.length !== allKeys.length || payload.bodies.some((body, index) => {
    if (!body || body.key !== allKeys[index] || body.category !== (index < PRIMARY_BODY_KEYS.length ? 'primary' : 'additional') || body.source !== 'swiss-ephemeris') return true;
    if (body.status === 'unavailable') return body.category !== 'additional' || !['ephemeris-unavailable', 'saved-placement-unavailable'].includes(body.reason) ||
      Object.keys(body).sort().join('|') !== unavailableKeys.join('|');
    if (Object.keys(body).sort().join('|') !== availableKeys.join('|')) return true;
    const length = Math.hypot(body.vector.x, body.vector.y, body.vector.z);
    return !Number.isFinite(body.rightAscensionDeg) || body.rightAscensionDeg < 0 || body.rightAscensionDeg >= 360 ||
      !Number.isFinite(body.declinationDeg) || body.declinationDeg < -90 || body.declinationDeg > 90 ||
      !Number.isFinite(length) || Math.abs(length - 1) > 1e-12 || !Number.isFinite(body.longitude) || body.longitude < 0 || body.longitude >= 360;
  })) return false;
  const unavailable = payload.bodies.filter(body => body.status === 'unavailable').map(body => body.key);
  if (unavailable.length !== payload.availability.optionalUnavailable.length || unavailable.some((key, index) => key !== payload.availability!.optionalUnavailable[index])) return false;
  if (payload.namedStars.length !== 8 || payload.namedStars.some(star => {
    try { assertMatchingFrames(payload.frame!, star.frame); } catch { return true; }
    const length = Math.hypot(star.vector.x, star.vector.y, star.vector.z);
    return star.status !== 'available' || !Number.isFinite(star.rightAscensionDeg) || !Number.isFinite(star.declinationDeg) ||
      !Number.isFinite(length) || Math.abs(length - 1) > 1e-12;
  })) return false;
  return true;
}

export class NavigatorCalculationError extends Error {
  readonly code = 'NAVIGATOR_CALCULATION_FAILED';
  constructor(message = 'Natal navigator calculation failed') {
    super(message);
    this.name = 'NavigatorCalculationError';
  }
}

export type SavedNatalChartRow = {
  birth_date: unknown;
  birth_time: unknown;
  timezone: unknown;
  latitude: unknown;
  longitude: unknown;
  unknown_time?: unknown;
  natal_positions: unknown;
};

type SavedPlacement = {
  key: string;
  label?: string;
  glyph?: string;
  longitude: number;
  degreeInSign: number;
  sign: string;
  signLabel: string;
  signGlyph: string;
  house: number | null;
  retrograde: boolean;
  dignity: 'domicile' | 'exaltation' | 'detriment' | 'fall' | null;
  description: string;
};

const SAVED_PLACEMENT_KEYS = [
  'degreeInSign', 'description', 'dignity', 'glyph', 'house', 'key', 'label', 'longitude',
  'retrograde', 'sign', 'signGlyph', 'signLabel',
] as const;
const DIGNITIES = new Set(['domicile', 'exaltation', 'detriment', 'fall']);

function datePart(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : '';
}

function timePart(value: unknown): string {
  if (value instanceof Date) return value.toTimeString().slice(0, 8);
  return typeof value === 'string' ? value : '';
}

function savedCoordinate(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return Number.NaN;
  return Number(value);
}

function zonedParts(formatter: Intl.DateTimeFormat, instant: number) {
  const result: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  }
  return result;
}

export function resolveSavedBirthAnchor(row: Omit<SavedNatalChartRow, 'natal_positions'> & Partial<Pick<SavedNatalChartRow, 'natal_positions'>>) {
  if (row.unknown_time) throw new NavigatorCalculationError('Exact birth time is required');
  const date = datePart(row.birth_date);
  const time = timePart(row.birth_time);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  const timezone = typeof row.timezone === 'string' ? row.timezone : '';
  const latitude = savedCoordinate(row.latitude);
  const longitude = savedCoordinate(row.longitude);
  if (!dateMatch || !timeMatch || !timezone || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new NavigatorCalculationError('Saved birth anchor is incomplete');
  }
  const [year, month, day] = dateMatch.slice(1).map(Number);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new NavigatorCalculationError('Saved birth date or time is invalid');
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    throw new NavigatorCalculationError('Saved timezone is invalid');
  }

  const wanted = { year, month, day, hour, minute, second };
  const offsets = new Set<number>();
  for (let deltaHours = -48; deltaHours <= 48; deltaHours += 6) {
    const sample = naive + deltaHours * 3600000;
    const parts = zonedParts(formatter, sample);
    offsets.add(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - sample);
  }
  const candidates = [...offsets]
    .map(offset => naive - offset)
    .filter(candidate => {
      const parts = zonedParts(formatter, candidate);
      return Object.entries(wanted).every(([key, value]) => parts[key] === value);
    });
  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length !== 1) {
    throw new NavigatorCalculationError('Saved local birth time is nonexistent or ambiguous in its timezone');
  }
  const utcDate = new Date(uniqueCandidates[0]);
  return {
    utc: utcDate.toISOString(),
    timezone,
    latitude,
    longitude,
    julianDayUt: utcDate.getTime() / 86400000 + 2440587.5,
  };
}

function parsePlacements(value: unknown): SavedPlacement[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray((parsed as { planets?: unknown[] } | null)?.planets)
      ? (parsed as { planets: SavedPlacement[] }).planets
      : [];
  } catch {
    return [];
  }
}

function savedBodyIdentity(key: string) {
  return getPlanet(key) ?? { key, label: key, glyph: '•', description: '' };
}

function validPlacement(value: SavedPlacement | undefined, expectedKey?: string): value is SavedPlacement {
  if (!value || typeof value.key !== 'string' || typeof value.label !== 'string' || !value.label || typeof value.glyph !== 'string' || !value.glyph ||
      !Number.isFinite(value.longitude) || value.longitude < 0 || value.longitude >= 360 || !Number.isFinite(value.degreeInSign) ||
      value.degreeInSign < 0 || value.degreeInSign >= 30 || typeof value.sign !== 'string' || typeof value.signLabel !== 'string' || typeof value.signGlyph !== 'string' ||
      (value.house !== null && (!Number.isInteger(value.house) || value.house < 1 || value.house > 12)) || typeof value.retrograde !== 'boolean' ||
      (value.dignity !== null && !DIGNITIES.has(value.dignity)) || typeof value.description !== 'string' ||
      Object.keys(value).sort().join('|') !== [...SAVED_PLACEMENT_KEYS].sort().join('|')) return false;
  if (expectedKey) {
    const identity = savedBodyIdentity(expectedKey);
    if (value.key !== expectedKey || value.label !== identity.label || value.glyph !== identity.glyph) return false;
  }
  const derived = signFromLongitude(value.longitude);
  return value.sign === derived.sign.key && value.signLabel === derived.sign.label && value.signGlyph === derived.sign.glyph &&
    Math.abs(value.degreeInSign - derived.degreeInSign) <= 1e-9;
}

function swissResultIsContractCompatible(result: { returnCode: number; xx: Float64Array }): boolean {
  const ephemerisMask = Constants.SEFLG_JPLEPH | Constants.SEFLG_SWIEPH | Constants.SEFLG_MOSEPH;
  const requiredBits = Constants.SEFLG_EQUATORIAL | Constants.SEFLG_XYZ | Constants.SEFLG_J2000 | Constants.SEFLG_NONUT |
    Constants.SEFLG_NOABERR | Constants.SEFLG_NOGDEFL | Constants.SEFLG_ICRS;
  return result.returnCode >= 0 && (result.returnCode & ephemerisMask) === Constants.SEFLG_SWIEPH &&
    (result.returnCode & requiredBits) === requiredBits && Array.from(result.xx.slice(0, 3)).every(Number.isFinite) &&
    Math.hypot(result.xx[0], result.xx[1], result.xx[2]) > 0;
}

export async function buildNatalNavigator(
  row: SavedNatalChartRow,
  dependencies: { getEph: () => Promise<SwissEph> } = { getEph },
): Promise<NatalNavigatorResponse> {
  const anchor = resolveSavedBirthAnchor(row);
  const placements = parsePlacements(row.natal_positions);
  for (const key of [...PRIMARY_BODY_KEYS, ...ADDITIONAL_BODY_KEYS]) {
    if (placements.filter(item => item?.key === key).length > 1) throw new NavigatorCalculationError('Duplicate saved placement');
  }
  for (const key of PRIMARY_BODY_KEYS) {
    if (!validPlacement(placements.find(item => item.key === key), key)) {
      throw new NavigatorCalculationError('Required saved placement is unavailable');
    }
  }
  const eph = await dependencies.getEph();
  const optionalUnavailable: string[] = [];
  const bodies: NavigatorBody[] = [];

  for (const [category, keys] of [
    ['primary', PRIMARY_BODY_KEYS],
    ['additional', ADDITIONAL_BODY_KEYS],
  ] as const) {
    for (const key of keys) {
      const placement = placements.find(item => item.key === key);
      const info = key === 'juno' ? { label: 'Juno', glyph: '⚵' } :
        key === 'northnode' ? { label: 'True North Node', glyph: '☊' } :
        getPlanet(key) ?? { label: key, glyph: '•' };
      const result = eph.swe_calc_ut(anchor.julianDayUt, BODY_IDS[key], NAVIGATOR_FLAGS);
      if (!validPlacement(placement, key) || !swissResultIsContractCompatible(result)) {
        if (category === 'primary') throw new NavigatorCalculationError('Required Swiss coordinate is unavailable');
        optionalUnavailable.push(key);
        bodies.push({
          key, label: info.label, glyph: info.glyph, category, status: 'unavailable',
          reason: validPlacement(placement, key) ? 'ephemeris-unavailable' : 'saved-placement-unavailable',
          source: 'swiss-ephemeris',
        });
        continue;
      }
      const [x, y, z] = Array.from(result.xx.slice(0, 3));
      const spherical = cartesianEquatorialToRaDec(x, y, z);
      const vector = equatorialCartesianToSceneVector(x, y, z);
      bodies.push({
        key, label: info.label, glyph: info.glyph, category, status: 'available',
        rightAscensionDeg: spherical.rightAscensionDeg, declinationDeg: spherical.declinationDeg, vector,
        longitude: placement.longitude, sign: placement.sign, signLabel: placement.signLabel,
        degreeInSign: placement.degreeInSign, house: placement.house, retrograde: placement.retrograde,
        source: 'swiss-ephemeris',
      });
    }
  }

  return {
    schemaVersion: NAVIGATOR_SCHEMA_VERSION,
    frame: { ...NAVIGATOR_FRAME_BASE, epoch: anchor.utc },
    birthAnchor: { utc: anchor.utc, timezone: anchor.timezone, source: 'saved-natal-chart' },
    bodies,
    namedStars: getNamedStarsAtEpoch(anchor.julianDayUt, anchor.utc),
    source: {
      engine: 'swiss-ephemeris', package: '@fusionstrings/swiss-eph', flags: NAVIGATOR_FLAGS,
      calculationTime: 'UTC-derived Julian day supplied as tjd_ut',
    },
    availability: { primary: 'available', optionalUnavailable },
  };
}
