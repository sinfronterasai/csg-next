// Transit computation built on the SAME Swiss Ephemeris source as the birth
// chart (chartEngine.getEph). Forward-date lookups against the saved natal
// chart are the compute engine for the Transit Forecast, Synastry, and Daily
// Dispatch reports. No ad-hoc ephemeris, no LLM math. (report-design PART 3 #7)

import { getEph, PLANET_BODIES, normDeg } from '@/lib/chartEngine';
import { getPlanet, signFromLongitude } from '@/lib/astrology';
import { Constants } from '@fusionstrings/swiss-eph';

// Tropical, with speed (so we can detect retrograde) — same flags as chartEngine.
const EPH_FLAGS = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL | Constants.SEFLG_SPEED;

export type TransitBodyKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

const TRANSIT_BODIES: TransitBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

export interface TransitBody {
  key: TransitBodyKey;
  label: string;
  glyph: string;
  longitude: number;   // 0..360 on the given date
  sign: string;
  signLabel: string;
  signGlyph: string;
  degreeInSign: number;
  retrograde: boolean;
}

/**
 * Compute longitude + sign for each transit body on a given UTC Julian Day.
 * Reuses the loaded Swiss Ephemeris instance from chartEngine — never loads a
 * second WASM copy.
 */
export async function computeTransitBodies(jd: number): Promise<TransitBody[]> {
  const eph = await getEph();
  return TRANSIT_BODIES.map((key) => {
    const meta = PLANET_BODIES.find((b) => b.key === key)!;
    const res = eph.swe_calc_ut(jd, meta.se, EPH_FLAGS);
    const long = normDeg(res.xx[0]);
    const speed = res.xx[3];
    const { sign, degreeInSign } = signFromLongitude(long);
    const info = getPlanet(key) || { label: key, glyph: '•' };
    return {
      key,
      label: info.label,
      glyph: info.glyph,
      longitude: long,
      sign: sign.key,
      signLabel: sign.label,
      signGlyph: sign.glyph,
      degreeInSign,
      retrograde: speed < 0,
    };
  });
}

export interface Aspect {
  transit: TransitBodyKey;
  transitLabel: string;
  transitGlyph: string;
  natalKey: string;        // natal planet key or 'asc' | 'mc'
  natalLabel: string;
  aspectType: AspectType;
  label: string;           // human label, e.g. "Trine" (from ASPECT_LABEL)
  orb: number;             // degrees, positive
  transitLongitude: number;
  natalLongitude: number;
  house: number | null;    // house of the natal point, if known
}

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

// Major aspects: angle + allowable orb.
const ASPECT_DEFS: { type: AspectType; angle: number; orb: number }[] = [
  { type: 'conjunction', angle: 0, orb: 8 },
  { type: 'sextile', angle: 60, orb: 5 },
  { type: 'square', angle: 90, orb: 6 },
  { type: 'trine', angle: 120, orb: 6 },
  { type: 'opposition', angle: 180, orb: 8 },
];

/** Short, human label for aspect + pair (used in report copy). */
export const ASPECT_LABEL: Record<AspectType, string> = {
  conjunction: 'Conjunction',
  sextile: 'Sextile',
  square: 'Square',
  trine: 'Trine',
  opposition: 'Opposition',
};

// 360-degree angular distance between two longitudes (0..180).
function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(diff, 360 - diff);
}

/**
 * Find major aspects between the set of transit bodies and a list of natal
 * points (natal planets + angles). `natalLongitudes` maps a key to its
 * ecliptic longitude; `natalHouses` optionally maps the same key to a house.
 */
export function findAspects(
  transitBodies: TransitBody[],
  natalLongitudes: { key: string; label: string; longitude: number; house?: number | null }[],
): Aspect[] {
  const out: Aspect[] = [];
  for (const t of transitBodies) {
    for (const n of natalLongitudes) {
      for (const def of ASPECT_DEFS) {
        const dist = angularDistance(t.longitude, n.longitude);
        // distance to the aspect point (direct angle OR its complement, since
        // an aspect is symmetric: 60deg == 300deg).
        const error = Math.min(
          Math.abs(dist - def.angle),
          Math.abs(dist - (360 - def.angle)),
        );
        if (error <= def.orb) {
          out.push({
            transit: t.key,
            transitLabel: t.label,
            transitGlyph: t.glyph,
            natalKey: n.key,
            natalLabel: n.label,
            aspectType: def.type,
            label: ASPECT_LABEL[def.type],
            orb: +error.toFixed(2),
            transitLongitude: t.longitude,
            natalLongitude: n.longitude,
            house: n.house ?? null,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Moon phase for a UTC Julian Day. Returns 0..1 phase fraction (0=new, 0.5=full)
 * using the Sun-Moon elongation. Powers the Daily Dispatch "moon phase of day".
 */
export async function moonPhase(jd: number): Promise<{ phase: number; label: string }> {
  const eph = await getEph();
  const sun = normDeg(eph.swe_calc_ut(jd, Constants.SE_SUN, EPH_FLAGS).xx[0]);
  const moon = normDeg(eph.swe_calc_ut(jd, Constants.SE_MOON, EPH_FLAGS).xx[0]);
  let elong = moon - sun;
  elong = ((elong % 360) + 360) % 360;
  const phase = elong / 360;
  let label = 'Waxing Crescent';
  if (phase < 0.03 || phase > 0.97) label = 'New Moon';
  else if (phase < 0.22) label = 'Waxing Crescent';
  else if (phase < 0.28) label = 'First Quarter';
  else if (phase < 0.47) label = 'Waxing Gibbous';
  else if (phase < 0.53) label = 'Full Moon';
  else if (phase < 0.72) label = 'Waning Gibbous';
  else if (phase < 0.78) label = 'Last Quarter';
  else label = 'Waning Crescent';
  return { phase: +phase.toFixed(3), label };
}

/** Convert a JS Date (UTC) to a Julian Day — shared basis with chartEngine. */
export function dateToJulianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}
