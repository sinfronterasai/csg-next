// Single source of truth for chart computation.
// birth-chart computes it live; my-chart loads the same normalized shape from storage.
'use client';

import pkg from 'circular-natal-horoscope-js';
const { Origin, Horoscope } = pkg;
import {
  SIGNS, getSign, getPlanet, getHouse, signFromLongitude, dignityFor, formatDegree, SignKey,
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
  birth: {
    date: string;        // yyyy-mm-dd
    time: string;        // HH:mm
    location: string;
    latitude: number;
    longitude: number;
    unknownTime: boolean;
  };
  planets: PlanetPlacement[];
  angles: AnglePlacement[];
  houses: HousePlacement[];
  ascendant: AnglePlacement;
  midheaven: AnglePlacement;
  sun: PlanetPlacement;
  moon: PlanetPlacement;
}

// Minimal geocoder: known cities + falls back to a small table.
const CITY_TABLE: Record<string, { lat: number; lon: number }> = {
  'paris, france': { lat: 48.8566, lon: 2.3522 },
  'new york, ny': { lat: 40.7128, lon: -74.006 },
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
  // crude: allow "lat,lon"
  const m = key.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  // default to Paris if unknown (keeps demo working); real geocoding can be added later
  return CITY_TABLE['paris, france'];
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

function buildPlacement(raw: any, planetKey: string): PlanetPlacement {
  const info = getPlanet(planetKey) || { key: planetKey, label: planetKey, glyph: '•', description: '' };
  const long = raw?.ChartPosition?.Ecliptic?.DecimalDegrees ?? 0;
  const { sign, degreeInSign } = signFromLongitude(long);
  return {
    key: planetKey,
    label: info.label,
    glyph: info.glyph,
    longitude: normDeg(long),
    degreeInSign,
    sign: sign.key,
    signLabel: sign.label,
    signGlyph: sign.glyph,
    house: raw?.House?.id ?? null,
    retrograde: Boolean(raw?.isRetrograde),
    dignity: dignityFor(planetKey, sign.key),
    description: info.description,
  };
}

function buildAngle(raw: any, key: string, label: string): AnglePlacement {
  const long = raw?.ChartPosition?.Ecliptic?.DecimalDegrees ?? 0;
  const { sign, degreeInSign } = signFromLongitude(long);
  return {
    key, label,
    longitude: normDeg(long),
    sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph, degreeInSign,
  };
}

function buildHouse(raw: any, num: number): HousePlacement {
  const info = getHouse(num) || { num, label: `House ${num}`, area: '', description: '' };
  const long = raw?.ChartPosition?.Ecliptic?.DecimalDegrees ?? 0;
  const { sign } = signFromLongitude(long);
  return {
    num, label: info.label, area: info.area,
    cuspLongitude: normDeg(long),
    sign: sign.key, signLabel: sign.label, signGlyph: sign.glyph,
    description: info.description,
  };
}

export function computeChart(input: {
  name: string;
  date: string;       // yyyy-mm-dd
  time?: string;      // HH:mm
  location: string;
  unknownTime?: boolean;
}): ChartData {
  const [year, month, day] = input.date.split('-').map(Number);
  const [h, mi] = (input.time || '12:00').split(':').map(Number);
  const { lat, lon } = geocode(input.location);

  const origin = new Origin({
    year, month, date: day,
    hour: input.unknownTime ? 12 : h,
    minute: input.unknownTime ? 0 : mi,
    second: 0,
    latitude: lat,
    longitude: lon,
  });

  const hscope = new Horoscope({
    origin,
    houseSystem: input.unknownTime ? 'whole-sign' : 'placidus',
    zodiac: 'tropical',
    language: 'en',
  });

  const bodies = hscope.CelestialBodies || {};
  const points = hscope.CelestialPoints || {};
  const planetKeys = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northnode', 'southnode'];

  const planets: PlanetPlacement[] = planetKeys
    .map((k) => bodies[k] || points[k])
    .filter((b) => b)
    .map((b) => buildPlacement(b, b.key));

  const angles: AnglePlacement[] = [
    buildAngle(hscope.Ascendant, 'ascendant', 'Ascendant'),
    buildAngle(hscope.Midheaven, 'midheaven', 'Midheaven'),
  ];

  const housesRaw: any[] = Array.isArray(hscope.Houses) ? hscope.Houses : [];
  const houses: HousePlacement[] = housesRaw
    .map((hr) => buildHouse(hr, hr.id))
    .sort((a, b) => a.num - b.num);

  const ascendant = angles[0];
  const midheaven = angles[1];
  const sun = planets.find((p) => p.key === 'sun')!;
  const moon = planets.find((p) => p.key === 'moon')!;

  return {
    name: input.name ? `${input.name}'s Map` : 'Natal Map',
    birth: {
      date: input.date,
      time: input.unknownTime ? '' : (input.time || ''),
      location: input.location,
      latitude: lat,
      longitude: lon,
      unknownTime: Boolean(input.unknownTime),
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
