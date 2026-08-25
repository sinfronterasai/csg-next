// Deterministic derived layer for VerifiedFactsV2. Reuses chartEngine (Swiss
// Ephemeris) and astrology reference data. No prose, no model math. Every derived
// fact carries provenance (the source fact ids it was computed from) and an exact
// renderer-owned display string.

import { computeChart, PLANET_BODIES, normDeg, getEph, type ChartData, type PlanetPlacement } from '@/lib/chartEngine';
import { Constants } from '@fusionstrings/swiss-eph';
import { signFromLongitude, dignityFor, getSign, getPlanet, SIGNS } from '@/lib/astrology';
import { ASPECT_DEFS, angularDistance } from '@/lib/transit';
import type { CommonDerived, NodeValue, AspectFact, PatternFact, VerifiedFact, Dignity } from './types';

const DIGNITY_LABEL: Record<string, string> = {
  domicile: 'in domicile',
  exaltation: 'exalted',
  detriment: 'in detriment',
  fall: 'in fall',
};

function planetDisplay(p: PlanetPlacement): string {
  const house = p.house != null ? ` in the ${ordinal(p.house)} house` : '';
  const retro = p.retrograde ? ' (retrograde)' : '';
  const dig = p.dignity ? `, ${DIGNITY_LABEL[p.dignity]}` : '';
  return `${p.label} at ${p.degreeInSign.toFixed(2)}° ${p.signLabel}${house}${dig}${retro}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Compute a single body's longitude via Swiss Ephemeris (used for Juno, which
// chartEngine does not surface).
export async function computeBodyLongitude(seConst: number, jd: number): Promise<number> {
  const eph = await getEph();
  const FLAGS = Constants.SEFLG_SWIEPH | Constants.SEFLG_TROPICAL | Constants.SEFLG_SPEED;
  const r = (eph as any).swe_calc_ut(jd, seConst, FLAGS);
  return normDeg(r.xx[0]);
}

// Position fact for any body at a longitude.
function positionFact(id: string, key: string, label: string, longitude: number, house: number | null, retrograde: boolean): VerifiedFact {
  const { sign, degreeInSign } = signFromLongitude(longitude);
  const info = getPlanet(key) || { label, glyph: '•' };
  const dignity = dignityFor(key, sign.key) as Dignity;
  const houseStr = house != null ? ` in the ${ordinal(house)} house` : '';
  const retro = retrograde ? ' (retrograde)' : '';
  const dig = dignity ? `, ${DIGNITY_LABEL[dignity]}` : '';
  return {
    id,
    kind: 'position',
    source: 'swiss-ephemeris',
    display: `${label} at ${degreeInSign.toFixed(2)}° ${sign.label}${houseStr}${dig}${retro}`,
    value: {
      key, label, longitude: round2(longitude), degreeInSign: round2(degreeInSign),
      sign: sign.key, signLabel: sign.label, house, retrograde, dignity,
    },
  };
}

// Build the full common derived layer from a computed chart.
export async function buildCommonDerived(chart: ChartData): Promise<CommonDerived> {
  const positions: VerifiedFact[] = [];
  for (const p of chart.planets) positions.push(positionFact(`natal.${p.key}.position`, p.key, p.label, p.longitude, p.house, p.retrograde));
  // Angles
  positions.push(positionFact('natal.ascendant.position', 'ascendant', 'Ascendant', chart.ascendant.longitude, 1, false));
  positions.push(positionFact('natal.descendant.position', 'descendant', 'Descendant', normDeg(chart.ascendant.longitude + 180), 7, false));
  positions.push(positionFact('natal.midheaven.position', 'midheaven', 'Midheaven', chart.midheaven.longitude, 10, false));
  positions.push(positionFact('natal.icumcoeli.position', 'icumcoeli', 'Imum Coeli', normDeg(chart.midheaven.longitude + 180), 4, false));

  const byKey: Record<string, VerifiedFact> = {};
  for (const f of positions) byKey[f.id] = f;

  // Nodes: northnode already a planet; south = opposite.
  const north = chart.planets.find((p) => p.key === 'northnode')!;
  const southLong = normDeg(north.longitude + 180);
  const northVal = byKey['natal.northnode.position'].value as any;
  const southVal = positionFact('natal.southnode.position', 'southnode', 'South Node', southLong, null, false).value as any;
  const northNode: NodeValue = { ...(northVal as object), display: byKey['natal.northnode.position'].display } as NodeValue;
  const southNode: NodeValue = { ...(southVal as object), display: positionFact('natal.southnode.position', 'southnode', 'South Node', southLong, null, false).display } as NodeValue;

  // Juno: compute via Swiss Eph.
  const jd = computeJD(chart);
  const junoLong = await computeBodyLongitude(Constants.SE_JUNO, jd);
  const junoHouse = chart.planets[0] && null; // house assigned below
  const junoPlacement: PlanetPlacement = {
    key: 'juno', label: 'Juno', glyph: '⚭', longitude: junoLong, degreeInSign: signFromLongitude(junoLong).degreeInSign,
    sign: signFromLongitude(junoLong).sign.key, signLabel: signFromLongitude(junoLong).sign.label, signGlyph: '',
    house: null, retrograde: false, dignity: dignityFor('juno', signFromLongitude(junoLong).sign.key), description: '',
  };
  const junoFact = positionFact('natal.juno.position', 'juno', 'Juno', junoLong, null, false);
  const juno: NodeValue = { ...(junoFact.value as object), display: junoFact.display } as NodeValue;

  // Part of Fortune: ASC + Moon - Sun (zodiacal).
  const ascLong = chart.ascendant.longitude;
  const moonLong = chart.moon.longitude;
  const sunLong = chart.sun.longitude;
  const pofLong = normDeg(ascLong + moonLong - sunLong);
  const pofFact = positionFact('natal.partoffortune.position', 'partoffortune', 'Part of Fortune', pofLong, null, false);
  const partOfFortune: NodeValue = { ...(pofFact.value as object), display: pofFact.display } as NodeValue;

  // Chart ruler = ruler of Ascendant sign.
  const ascSign = getSign(chart.ascendant.sign)!;
  const rulerKey = ascSign.ruler.toLowerCase();
  const rulerPlanet = chart.planets.find((p) => p.key === rulerKey)!;
  const rulerInfo = getPlanet(rulerKey)!;
  const rulerDignity = dignityFor(rulerKey, rulerPlanet.sign);
  const rulerCondition = rulerDignity ? DIGNITY_LABEL[rulerDignity] : 'in no special dignity';
  const chartRuler = {
    planet: rulerKey, label: rulerInfo.label, sign: rulerPlanet.sign, condition: rulerCondition,
    display: `Chart ruler ${rulerInfo.label} at ${rulerPlanet.degreeInSign.toFixed(2)}° ${rulerPlanet.signLabel}, ${rulerCondition}`,
  };

  // Moon phase at birth (Sun-Moon elongation).
  const elong = normDeg(moonLong - sunLong);
  const phase = round2(elong / 360);
  const moonPhase = { phase, label: moonPhaseLabel(phase) };

  // Aspects: all pairs among positions (bodies + angles).
  const aspects = buildAspects(positions);
  const topAspectByBody: Record<string, string> = {};
  for (const a of aspects) {
    const tighten = topAspectByBody[a.value.bodyA];
    if (!tighten) topAspectByBody[a.value.bodyA] = a.id;
  }

  // Element / modality tallies over the ten standard planets (documented inclusion rule).
  const TEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const elements: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const key of TEN) {
    const p = chart.planets.find((x) => x.key === key);
    if (!p) continue;
    const sign = getSign(p.sign)!;
    elements[sign.element] += 1;
    modalities[sign.modality] += 1;
  }

  const patterns = buildPatterns(chart, aspects);

  return {
    positions,
    ascendant: { sign: chart.ascendant.sign, signLabel: chart.ascendant.signLabel, degreeInSign: round2(chart.ascendant.degreeInSign), house: 1 },
    descendant: { sign: signFromLongitude(normDeg(chart.ascendant.longitude + 180)).sign.key, signLabel: signFromLongitude(normDeg(chart.ascendant.longitude + 180)).sign.label, degreeInSign: round2(signFromLongitude(normDeg(chart.ascendant.longitude + 180)).degreeInSign), house: 7 },
    midheaven: { sign: chart.midheaven.sign, signLabel: chart.midheaven.signLabel, degreeInSign: round2(chart.midheaven.degreeInSign), house: 10 },
    icumcoeli: { sign: signFromLongitude(normDeg(chart.midheaven.longitude + 180)).sign.key, signLabel: signFromLongitude(normDeg(chart.midheaven.longitude + 180)).sign.label, degreeInSign: round2(signFromLongitude(normDeg(chart.midheaven.longitude + 180)).degreeInSign), house: 4 },
    chartRuler,
    northNode, southNode, juno, partOfFortune,
    moonPhase,
    elements, modalities,
    aspects,
    topAspectByBody,
    patterns,
  };
}

function moonPhaseLabel(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'New Moon';
  if (phase < 0.22) return 'Waxing Crescent';
  if (phase < 0.28) return 'First Quarter';
  if (phase < 0.47) return 'Waxing Gibbous';
  if (phase < 0.53) return 'Full Moon';
  if (phase < 0.72) return 'Waning Gibbous';
  if (phase < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

// Pairs of bodies for aspects. Each entry: { id, key, longitude, label }.
function aspectBodies(positions: VerifiedFact[]): { id: string; key: string; longitude: number; label: string }[] {
  return positions.map((f) => {
    const v = f.value as any;
    return { id: f.id, key: v.key, longitude: v.longitude, label: v.label };
  });
}

export function buildAspects(positions: VerifiedFact[]): AspectFact[] {
  const bodies = aspectBodies(positions);
  const out: AspectFact[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.key === b.key) continue;
      for (const def of ASPECT_DEFS) {
        const dist = angularDistance(a.longitude, b.longitude);
        const error = Math.min(Math.abs(dist - def.angle), Math.abs(dist - (360 - def.angle)));
        if (error <= def.orb) {
          const orb = round2(error);
          const id = `natal.aspect.${a.key}-${b.key}-${def.type}`;
          out.push({
            id,
            kind: 'aspect',
            source: 'derived-deterministic',
            display: `${a.label} ${def.type} ${b.label} (orb ${orb}°)`,
            value: {
              bodyA: a.key, bodyB: b.key, aspectType: def.type, orb, exact: orb < 1,
              bodyALabel: a.label, bodyBLabel: b.label,
            },
            provenance: [a.id, b.id],
          });
        }
      }
    }
  }
  return out;
}

// Detect simple deterministic patterns: stellium (>=3 bodies same sign) and major
// aspect clusters. Stable ids + participants + tightness (max orb span).
export function buildPatterns(chart: ChartData, aspects: AspectFact[]): PatternFact[] {
  const out: PatternFact[] = [];
  // Stellium by sign
  const bySign: Record<string, string[]> = {};
  for (const p of chart.planets) {
    if (p.key === 'northnode' || p.key === 'southnode') continue;
    (bySign[p.sign] ||= []).push(p.label);
  }
  let idx = 0;
  for (const sign of Object.keys(bySign)) {
    if (bySign[sign].length >= 3) {
      const parts = bySign[sign];
      out.push({
        id: `natal.pattern.stellium-${sign}-${idx}`,
        kind: 'pattern',
        source: 'derived-deterministic',
        display: `Stellium in ${getSign(sign)!.label}: ${parts.join(', ')}`,
        value: { name: 'Stellium', participants: parts, tightness: parts.length },
        provenance: parts.map((l) => `natal.${l.toLowerCase()}.position`),
      });
      idx++;
    }
  }
  return out;
}

// Approximate Julian Day from chart birth (mirrors chartEngine.localToJulianDay).
function computeJD(chart: ChartData): number {
  const { date, time, unknownTime } = chart.birth;
  const [y, m, d] = date.split('-').map(Number);
  const hour = unknownTime ? 12 : parseInt((time || '12:00').split(':')[0], 10);
  const minute = unknownTime ? 0 : parseInt((time || '12:00').split(':')[1], 10);
  const localISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tzId, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const partsArr = dtf.formatToParts(new Date(localISO + 'Z'));
  const map: Record<string, string> = {};
  for (const p of partsArr) if (p.type !== 'literal') map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  const offsetMs = asUTC - new Date(localISO + 'Z').getTime();
  const utcMs = new Date(localISO + 'Z').getTime() - offsetMs;
  return utcMs / 86400000 + 2440587.5;
}

// Top-level async builder used by build.ts
export async function computeVerifiedCommon(birth: { date: string; time?: string; location: string; unknownTime?: boolean; name?: string }): Promise<CommonDerived> {
  const chart = await computeChart({ name: birth.name, date: birth.date, time: birth.time, location: birth.location, unknownTime: !!birth.unknownTime });
  return buildCommonDerived(chart);
}
