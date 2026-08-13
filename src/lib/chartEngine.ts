// Single source of truth for chart computation.
// IMPORTANT: all astronomy is performed by Swiss Ephemeris (swisseph WASM via
// @fusionstrings/swiss-eph). This module only CALLS the engine and INTERPRETS its
// numbers (maps ecliptic longitude -> sign, looks up dignities). No astronomical
// math is written here, so there is no room for calculation error.
// Server-only: runs Swiss Ephemeris (WASM + fs). Never imported into client components.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Constants, load, type SwissEph } from '@fusionstrings/swiss-eph';
import tzlookup from 'tz-lookup';
import {
  getSign, getPlanet, getHouse, signFromLongitude, dignityFor, formatDegree, SignKey,
} from './astrology';

export interface PlanetPlacement {
  key: string;
  label: string;
  glyph: string;
  longitude: number;        // ecliptic degrees 0..360
  degreeInSign: number;
  sign: SignKey;
  signLabel: string;
  signGlyph: string;
  house: number | null;
  retrograde: boolean;
  dignity: 'domicile' | 'exaltation' | 'detriment' | 'fall' | null;
  description: string;
}

export interface AnglePlacement {
  key: string;
  label: string;
  longitude: number;
  sign: SignKey;
  signLabel: string;
  signGlyph: string;
  degreeInSign: number;
}

export interface HousePlacement {
  num: number;
  label: string;
  area: string;
  cuspLongitude: number;
  sign: SignKey;
  signLabel: string;
  signGlyph: string;
  description: string;
}

export interface ChartData {
  name: string;
  birth: { date: string; time: string; location: string; latitude: number; longitude: number; unknownTime: boolean };
  planets: PlanetPlacement[];
  angles: AnglePlacement[];
  houses: HousePlacement[];
  ascendant: AnglePlacement;
  midheaven: AnglePlacement;
  sun: PlanetPlacement;
  moon: PlanetPlacement;
}

// planet key -> Swiss Ephemeris body constant + our astrology.ts key
export const PLANET_BODIES: { key: string; se: number }[] = [
  { key: 'sun', se: Constants.SE_SUN },
  { key: 'moon', se: Constants.SE_MOON },
  { key: 'mercury', se: Constants.SE_MERCURY },
  { key: 'venus', se: Constants.SE_VENUS },
  { key: 'mars', se: Constants.SE_MARS },
  { key: 'jupiter', se: Constants.SE_JUPITER },
  { key: 'saturn', se: Constants.SE_SATURN },
  { key: 'uranus', se: Constants.SE_URANUS },
  { key: 'neptune', se: Constants.SE_NEPTUNE },
  { key: 'pluto', se: Constants.SE_PLUTO },
  { key: 'chiron', se: Constants.SE_CHIRON },
  { key: 'northnode', se: Constants.SE_TRUE_NODE },
];

// Swiss Ephemeris WASM is loaded once and reused across charts.
let ephPromise: Promise<SwissEph> | null = null;
export function getEph(): Promise<SwissEph> {
  if (!ephPromise) {
    const wasmBytes = readFileSync(join(process.cwd(), 'node_modules/@fusionstrings/swiss-eph/wasm/swiss_eph.wasm'));
    ephPromise = load(wasmBytes as unknown as Uint8Array);
  }
  return ephPromise;
}

// Convert a local wall-clock datetime + IANA timezone to a UTC Julian Day.
function localToJulianDay(year: number, month: number, day: number, hour: number, minute: number, tzId: string): number {
  const localISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  // Offset in minutes east of UTC for this instant.
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tzId, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = dtf.formatToParts(new Date(localISO + 'Z'));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  const offsetMs = asUTC - new Date(localISO + 'Z').getTime();
  const utcMs = new Date(localISO + 'Z').getTime() - offsetMs;
  const utcDate = new Date(utcMs);
  const jd = (utcDate.getTime() / 86400000) + 2440587.5;
  return jd;
}

export function normDeg(d: number): number { return ((d % 360) + 360) % 360; }

// Determine which house a longitude falls in, given the 12 cusp longitudes (cusps[1..12]).
export function houseForLongitude(longitude: number, cusps: number[]): number | null {
  const L = normDeg(longitude);
  for (let i = 1; i <= 12; i++) {
    const start = normDeg(cusps[i]);
    const end = normDeg(cusps[i === 12 ? 1 : i + 1]);
    if (end <= start) {
      if (L >= start || L < end) return i;
    } else if (L >= start && L < end) {
      return i;
    }
  }
  return null;
}


// Lightweight geocoder. Fast path for known cities; also accepts "lat,lon".
// (A full geocoding API can be swapped in here without touching the engine.)
const CITY_TABLE: Record<string, { lat: number; lon: number }> = {
  'paris, france': { lat: 48.8566, lon: 2.3522 },
  'new york, ny': { lat: 40.7128, lon: -74.006 },
  'new york': { lat: 40.7128, lon: -74.006 },
  'london, uk': { lat: 51.5074, lon: -0.1278 },
  'london': { lat: 51.5074, lon: -0.1278 },
  'los angeles, ca': { lat: 34.0522, lon: -118.2437 },
  'berlin, germany': { lat: 52.52, lon: 13.405 },
  'tokyo, japan': { lat: 35.6762, lon: 139.6503 },
  'mumbai, india': { lat: 19.076, lon: 72.8777 },
  'sydney, australia': { lat: -33.8688, lon: 151.2093 },
  'mexico city, mexico': { lat: 19.4326, lon: -99.1332 },
  'cairo, egypt': { lat: 30.0444, lon: 31.2357 },
};

export function geocode(location: string): { lat: number; lon: number } {
  const key = location.trim().toLowerCase();
  if (CITY_TABLE[key]) return CITY_TABLE[key];
  const m = key.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  return CITY_TABLE['paris, france'];
}

export async function computeChart(input: {
  name?: string;      // optional; defaults when chart is computed from saved data
  date: string;       // yyyy-mm-dd
  time?: string;      // HH:mm
  location: string;
  unknownTime?: boolean;
}): Promise<ChartData> {
  const eph = await getEph();
  const { lat, lon } = geocode(input.location);
  const [year, month, day] = input.date.split('-').map(Number);
  const unknownTime = Boolean(input.unknownTime);
  const hour = unknownTime ? 12 : parseInt((input.time || '12:00').split(':')[0], 10);
  const minute = unknownTime ? 0 : parseInt((input.time || '12:00').split(':')[1], 10);

  // Local time -> UTC Julian Day using the location's IANA timezone (Swiss Eph wants UT).
  const tzId = safeTz(lat, lon);
  const jd = localToJulianDay(year, month, day, hour, minute, tzId);

  const FLAGS = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL | Constants.SEFLG_SPEED;

  const planets: PlanetPlacement[] = PLANET_BODIES.map(({ key, se }) => {
    const res = eph.swe_calc_ut(jd, se, FLAGS);
    const long = normDeg(res.xx[0]);
    const speed = res.xx[3];
    const { sign, degreeInSign } = signFromLongitude(long);
    const info = getPlanet(key) || { key, label: key, glyph: '•', description: '' };
    return {
      key,
      label: info.label,
      glyph: info.glyph,
      longitude: long,
      degreeInSign,
      sign: sign.key,
      signLabel: sign.label,
      signGlyph: sign.glyph,
      house: null, // filled after houses are computed
      retrograde: speed < 0,
      dignity: dignityFor(key, sign.key),
      description: info.description,
    };
  });

  // Houses via Swiss Ephemeris Placidus (or whole-sign when time unknown).
  // Swiss Ephemeris house-system code: 'P'=Placidus, 'W'=Whole Sign (char code).
  const houseSystem = unknownTime ? 'W'.charCodeAt(0) : 'P'.charCodeAt(0);
  const h = eph.swe_houses(jd, lat, lon, houseSystem);
  const cusps: number[] = [0];
  for (let i = 1; i <= 12; i++) cusps.push(normDeg((h.cusps as any)[i]));

  const ascLong = normDeg((h.ascmc as any)[0]);
  const mcLong = normDeg((h.ascmc as any)[1]);

  const houses: HousePlacement[] = cusps.slice(1).map((c, idx) => {
    const num = idx + 1;
    const info = getHouse(num) || { num, label: `House ${num}`, area: '', description: '' };
    const { sign } = signFromLongitude(c);
    return {
      num, label: info.label, area: info.area,
      cuspLongitude: c,
      sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph,
      description: info.description,
    };
  });

  // Assign each planet to its house.
  for (const p of planets) {
    const hh = houseForLongitude(p.longitude, cusps);
    p.house = unknownTime ? null : hh;
  }

  const angles: AnglePlacement[] = [
    angleFromLong(ascLong, 'ascendant', 'Ascendant'),
    angleFromLong(mcLong, 'midheaven', 'Midheaven'),
  ];

  const ascendant = angles[0];
  const midheaven = angles[1];
  const sun = planets.find((p) => p.key === 'sun')!;
  const moon = planets.find((p) => p.key === 'moon')!;

  return {
    name: input.name ? `${input.name}'s Map` : 'Natal Map',
    birth: {
      date: input.date,
      time: unknownTime ? '' : (input.time || ''),
      location: input.location,
      latitude: lat,
      longitude: lon,
      unknownTime,
    },
    planets,
    angles,
    houses,
    ascendant,
    midheaven,
    sun,
    moon,
  };
}

function angleFromLong(longitude: number, key: string, label: string): AnglePlacement {
  const { sign, degreeInSign } = signFromLongitude(longitude);
  return { key, label, longitude: normDeg(longitude), sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph, degreeInSign };
}

// tz-lookup returns an IANA tz string; wrapped for safety.
function safeTz(lat: number, lon: number): string {
  try {
    const tz = tzlookup(lat, lon);
    return tz || 'UTC';
  } catch {
    return 'UTC';
  }
}
