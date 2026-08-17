// Single source of truth for chart computation.
// IMPORTANT: all astronomy is performed by Swiss Ephemeris (swisseph WASM via
// @fusionstrings/swiss-eph). This module only CALLS the engine and INTERPRETS its
// numbers (maps ecliptic longitude -> sign, looks up dignities). No astronomical
// math is written here, so there is no room for calculation error.
// Server-only: runs Swiss Ephemeris (WASM + fs). Never imported into client components.

import { readFileSync } from 'fs';
import { join } from 'path';
import { Constants, load, type SwissEph } from '@fusionstrings/swiss-eph';
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


// Geocoder: fast-cache of common cities, then a real forward-geocode call
// Resolves a location to coordinates + IANA timezone. Uses Google Maps
// Geocoding (plus the Time Zone API, since Geocoding does not return a tz)
// when GOOGLE_MAPS_API_KEY is set; otherwise falls back to Open-Meteo (keyless).
// No longer depends on tz-lookup for the chart path.
export interface GeoResult { lat: number; lon: number; timezone: string; }

const CITY_TABLE: Record<string, GeoResult> = {
  'paris, france': { lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  'new york, ny': { lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  'new york': { lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  'london, uk': { lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  'london': { lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  'los angeles, ca': { lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles' },
  'berlin, germany': { lat: 52.52, lon: 13.405, timezone: 'Europe/Berlin' },
  'tokyo, japan': { lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  'mumbai, india': { lat: 19.076, lon: 72.8777, timezone: 'Asia/Kolkata' },
  'sydney, australia': { lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney' },
  'mexico city, mexico': { lat: 19.4326, lon: -99.1332, timezone: 'America/Mexico_City' },
  'cairo, egypt': { lat: 30.0444, lon: 31.2357, timezone: 'Africa/Cairo' },
};

// Resolve a location to coordinates + timezone.
// - exact "lat,lon" string -> parsed directly (timezone defaults to UTC)
// - known city in CITY_TABLE -> instant cache hit
// - GOOGLE_MAPS_API_KEY set -> Google Maps Geocoding + Time Zone API
// - otherwise -> Open-Meteo forward geocoding (keyless fallback)
// Returns null only for empty/unresolvable input; callers must reject null.
export async function geocodeLocation(location: string): Promise<GeoResult | null> {
  const raw = (location || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (CITY_TABLE[key]) return CITY_TABLE[key];
  const m = key.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]), timezone: 'UTC' };

  const gkey = process.env.GOOGLE_MAPS_API_KEY;
  if (gkey) {
    // Try Google first; if it fails to resolve, fall back to Open-Meteo.
    const viaGoogle = await googleGeocode(raw, gkey);
    if (viaGoogle) return viaGoogle;
  }
  return openMeteoGeocode(raw);
}

// Google Maps: Geocoding gives lat/lng; Time Zone API recovers the IANA tz
// (Google Geocoding does not return a timezone). Returns null on any failure.
async function googleGeocode(location: string, apiKey: string): Promise<GeoResult | null> {
  try {
    const g = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`);
    if (!g.ok) return null;
    const gj = await g.json();
    const res0 = gj?.results?.[0];
    if (!res0?.geometry?.location) return null;
    const { lat, lng } = res0.geometry.location;
    // Time Zone API needs a timestamp; use now.
    const t = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`);
    let tz = 'UTC';
    if (t.ok) {
      const tj = await t.json();
      if (tj?.timeZoneId) tz = tj.timeZoneId;
    }
    return { lat, lon: lng, timezone: tz };
  } catch {
    return null;
  }
}

// Open-Meteo forward geocoding (keyless). Returns null on failure.
async function openMeteoGeocode(location: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
    return { lat: r.latitude, lon: r.longitude, timezone: r.timezone || 'UTC' };
  } catch {
    return null;
  }
}

export async function computeChart(input: {
  name?: string;      // optional; defaults when chart is computed from saved data
  date: string;       // yyyy-mm-dd
  time?: string;      // HH:mm
  location: string;
  unknownTime?: boolean;
}): Promise<ChartData> {
  const eph = await getEph();
  const resolved = await geocodeLocation(input.location);
  if (!resolved) throw new Error(`geocode: could not resolve location "${input.location}"`);
  const { lat, lon, timezone } = resolved;
  const [year, month, day] = input.date.split('-').map(Number);
  const unknownTime = Boolean(input.unknownTime);
  const hour = unknownTime ? 12 : parseInt((input.time || '12:00').split(':')[0], 10);
  const minute = unknownTime ? 0 : parseInt((input.time || '12:00').split(':')[1], 10);

  // Local time -> UTC Julian Day using the location's IANA timezone (Swiss Eph wants UT).
  const tzId = timezone || 'UTC';
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
