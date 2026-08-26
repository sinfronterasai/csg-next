// Deterministic derived layer for VerifiedFactsV2. Reuses chartEngine (Swiss
// Ephemeris) and astrology reference data. No prose, no model math. Every derived
// fact carries provenance (the source fact ids it was computed from) and an exact
// renderer-owned display string.
//
// Astronomy accuracy (B4): Juno is now computed inside chartEngine via the same
// Julian Day / timezone / house cusps as every other body, so there is no
// server-timezone drift and Juno keeps its true retrograde + house. This module
// reads chart.juno like any other planet.

import { computeChart, normDeg, type ChartData, type PlanetPlacement } from '@/lib/chartEngine';
import { signFromLongitude, dignityFor, getSign, getPlanet } from '@/lib/astrology';
import { ASPECT_DEFS, angularDistance } from '@/lib/transit';
import type { CommonDerived, NodeValue, PositionValue, AspectFact, PatternFact, VerifiedFact, Dignity, FactSource } from './types';

const DIGNITY_LABEL: Record<string, string> = {
  domicile: 'in domicile',
  exaltation: 'exalted',
  detriment: 'in detriment',
  fall: 'in fall',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Full-precision longitude retained for aspect math (B5). display/storage round.
interface BodyLong {
  id: string;
  key: string;
  label: string;
  longitude: number; // full precision
  full: PlanetPlacement; // chartEngine placement (house, retrograde, dignity)
}

// Build a position fact. `source` + `provenance` distinguish direct ephemeris
// output from derived points (B8). Angles, Descendant, IC, South Node and Part of
// Fortune are derived-deterministic with explicit provenance, never 'swiss-ephemeris'.
function positionFact(id: string, key: string, label: string, longitude: number, house: number | null, retrograde: boolean, source: FactSource = 'swiss-ephemeris', provenance?: string[]): VerifiedFact {
  const { sign, degreeInSign } = signFromLongitude(longitude);
  const info = getPlanet(key) || { label, glyph: '•' };
  const dignity = dignityFor(key, sign.key) as Dignity;
  const houseStr = house != null ? ` in the ${ordinal(house)} house` : '';
  const retro = retrograde ? ' (retrograde)' : '';
  const dig = dignity ? `, ${DIGNITY_LABEL[dignity]}` : '';
  return {
    id,
    kind: 'position',
    source,
    display: `${label} at ${degreeInSign.toFixed(2)}° ${sign.label}${houseStr}${dig}${retro}`,
    value: {
      key, label, longitude: round2(longitude), degreeInSign: round2(degreeInSign),
      sign: sign.key, signLabel: sign.label, house, retrograde, dignity,
    },
    provenance,
  };
}

// Build the full common derived layer from a computed chart.
// When `unknownTime` is true, time-dependent facts (angles, chart ruler, Part of
// Fortune, houses, Moon degree, and any Moon/time-sensitive aspect) are OMITTED or
// marked uncertain, never fabricated from a default noon time (B9).
// Convert a position VerifiedFact into the NodeValue shape used by common.* fields.
function toNodeValue(fact: VerifiedFact): NodeValue {
  return { ...(fact.value as PositionValue), display: fact.display } as NodeValue;
}

export async function buildCommonDerived(chart: ChartData, unknownTime: boolean = (chart.birth?.unknownTime ?? false)): Promise<CommonDerived> {
  // Full-precision bodies for aspect math.
  const bodies: BodyLong[] = chart.planets.map((p) => ({
    id: `natal.${p.key}.position`,
    key: p.key,
    label: p.label,
    longitude: p.longitude,
    full: p,
  }));

  const positions: VerifiedFact[] = chart.planets.map((p) =>
    positionFact(`natal.${p.key}.position`, p.key, p.label, p.longitude, p.house, p.retrograde, 'swiss-ephemeris', undefined),
  );

  const byKey: Record<string, VerifiedFact> = {};
  for (const f of positions) byKey[f.id] = f;

  // South Node is derived from North Node (opposite point), not a direct ephemeris body.
  const north = chart.planets.find((p) => p.key === 'northnode')!;
  const southLong = normDeg(north.longitude + 180);
  const southFact = positionFact('natal.southnode.position', 'southnode', 'South Node', southLong, null, false, 'derived-deterministic', ['natal.northnode.position']);
  positions.push(southFact);
  byKey['natal.southnode.position'] = southFact;

  // Juno now comes straight from chartEngine (same JD/tz/houses, true retro + house).
  const juno = chart.planets.find((p) => p.key === 'juno')!;
  const junoFact = positionFact('natal.juno.position', 'juno', 'Juno', juno.longitude, juno.house, juno.retrograde, 'swiss-ephemeris', undefined);
  positions.push(junoFact);
  byKey['natal.juno.position'] = junoFact;

  const northNode = toNodeValue(byKey['natal.northnode.position']);
  const southNode = toNodeValue(southFact);
  const junoNode = toNodeValue(junoFact);

  // Moon is time-sensitive under unknown-time (B9): omit its position and any
  // aspect that involves it. All retained positions are marked uncertain because
  // their degrees are approximate under solar fallback.
  const moonBody = bodies.find((b) => b.key === 'moon');
  const timeSensitiveKeys = new Set<string>(['moon']);
  if (unknownTime) {
    // Remove Moon position from the facts map; keep Sun/nodes (sign-level only).
    delete byKey['natal.moon.position'];
    positions.splice(positions.findIndex((f) => f.id === 'natal.moon.position'), 1);
    for (const f of positions) {
      const v = f.value as any;
      if (v.key !== 'sun' && v.key !== 'northnode' && v.key !== 'southnode' && v.key !== 'juno') {
        (v as any).uncertain = true;
        f.display += ' (approximate; birth time unknown)';
      }
    }
  }

  // Part of Fortune (ASC + Moon - Sun) and chart ruler both depend on the Ascendant,
  // which requires a birth time. Omit both under unknown-time (derived-deterministic).
  let partOfFortune: VerifiedFact | undefined;
  let chartRuler: VerifiedFact | undefined;
  let ascendant: NodeValue | undefined;
  let descendant: NodeValue | undefined;
  let midheaven: NodeValue | undefined;
  let icumcoeli: NodeValue | undefined;

  if (!unknownTime) {
    const ascLong = chart.ascendant.longitude;
    const moonLong = chart.moon.longitude;
    const sunLong = chart.sun.longitude;

    const ascendantFact = positionFact('natal.ascendant.position', 'ascendant', 'Ascendant', chart.ascendant.longitude, 1, false, 'derived-deterministic', undefined);
    const descendantFact = positionFact('natal.descendant.position', 'descendant', 'Descendant', normDeg(chart.ascendant.longitude + 180), 7, false, 'derived-deterministic', ['natal.ascendant.position']);
    const midheavenFact = positionFact('natal.midheaven.position', 'midheaven', 'Midheaven', chart.midheaven.longitude, 10, false, 'derived-deterministic', undefined);
    const icumcoeliFact = positionFact('natal.icumcoeli.position', 'icumcoeli', 'Imum Coeli', normDeg(chart.midheaven.longitude + 180), 4, false, 'derived-deterministic', ['natal.midheaven.position']);
    positions.push(ascendantFact, descendantFact, midheavenFact, icumcoeliFact);
    byKey['natal.ascendant.position'] = ascendantFact;
    byKey['natal.descendant.position'] = descendantFact;
    byKey['natal.midheaven.position'] = midheavenFact;
    byKey['natal.icumcoeli.position'] = icumcoeliFact;
    ascendant = toNodeValue(ascendantFact);
    descendant = toNodeValue(descendantFact);
    midheaven = toNodeValue(midheavenFact);
    icumcoeli = toNodeValue(icumcoeliFact);

    const pofLong = normDeg(ascLong + moonLong - sunLong);
    partOfFortune = positionFact('natal.partoffortune.position', 'partoffortune', 'Part of Fortune', pofLong, null, false, 'derived-deterministic', ['natal.ascendant.position', 'natal.moon.position', 'natal.sun.position']);
    positions.push(partOfFortune);
    byKey['natal.partoffortune.position'] = partOfFortune;

    const ascSign = getSign(chart.ascendant.sign)!;
    const rulerKey = ascSign.ruler.toLowerCase();
    const rulerPlanet = chart.planets.find((p) => p.key === rulerKey)!;
    const rulerInfo = getPlanet(rulerKey)!;
    const rulerDignity = dignityFor(rulerKey, rulerPlanet.sign);
    const rulerCondition = rulerDignity ? DIGNITY_LABEL[rulerDignity] : 'in no special dignity';
    chartRuler = {
      id: 'common.chartRuler',
      kind: 'point',
      source: 'derived-deterministic',
      display: `Chart ruler ${rulerInfo.label} at ${rulerPlanet.degreeInSign.toFixed(2)}° ${rulerPlanet.signLabel}, ${rulerCondition}`,
      value: { planet: rulerKey, label: rulerInfo.label, sign: rulerPlanet.sign, condition: rulerCondition },
      provenance: ['natal.ascendant.position', `natal.${rulerKey}.position`],
    };
  }

  // Moon phase at birth (Sun-Moon elongation). Under unknown-time the exact Moon
  // degree is unreliable, so omit the phase fact (B9).
  let moonPhase: VerifiedFact | undefined;
  if (!unknownTime) {
    const elong = normDeg(chart.moon.longitude - chart.sun.longitude);
    const phase = round2(elong / 360);
    moonPhase = {
      id: 'common.moonPhase',
      kind: 'phase',
      source: 'derived-deterministic',
      display: `Moon phase ${moonPhaseLabel(phase)} (${phase.toFixed(2)} of cycle)`,
      value: { phase, label: moonPhaseLabel(phase) },
      provenance: ['natal.moon.position', 'natal.sun.position'],
    };
  }

  // Aspects: computed from FULL-precision longitudes (B5). Under unknown-time, drop
  // any aspect involving the Moon (time-sensitive).
  const aspectBodies = bodies.filter((b) => !(unknownTime && timeSensitiveKeys.has(b.key)));
  const aspects: AspectFact[] = buildAspects(aspectBodies);
  const topAspectByBody: Record<string, string> = {};
  for (const a of aspects) {
    // Tightest orb wins for BOTH participants (B5).
    for (const k of [a.value.bodyA, a.value.bodyB]) {
      const cur = topAspectByBody[k];
      if (!cur || (a.value.orb < (byKey[cur]?.value as any)?.orb)) topAspectByBody[k] = a.id;
    }
  }

  // Element / modality tallies (documented inclusion rule: the ten standard planets).
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
  // Provenance lists only bodies whose position fact is actually present (under
  // unknown-time the Moon position is intentionally omitted, so it is not cited).
  const presentPlanetIds = positions.filter((f) => f.kind === 'position' && TEN.includes((f.value as any).key)).map((f) => f.id);
  const elementsFact: VerifiedFact = {
    id: 'common.elements', kind: 'tally', source: 'derived-deterministic',
    display: `Element tally — Fire ${elements.Fire}, Earth ${elements.Earth}, Air ${elements.Air}, Water ${elements.Water}`,
    value: elements, provenance: presentPlanetIds,
  };
  const modalitiesFact: VerifiedFact = {
    id: 'common.modalities', kind: 'tally', source: 'derived-deterministic',
    display: `Modality tally — Cardinal ${modalities.Cardinal}, Fixed ${modalities.Fixed}, Mutable ${modalities.Mutable}`,
    value: modalities, provenance: presentPlanetIds,
  };

  const presentIds = new Set(positions.map((f) => f.id));
  const patterns = buildPatterns(chart, aspects, presentIds);

  const ret: CommonDerived = {
    positions,
    northNode, southNode, juno: junoNode,
    isSolarFallback: unknownTime,
    moonPhase: moonPhase!,
    elements: elementsFact,
    modalities: modalitiesFact,
    aspects,
    topAspectByBody,
    patterns,
  };
  if (!unknownTime) {
    ret.ascendant = ascendant;
    ret.descendant = descendant;
    ret.midheaven = midheaven;
    ret.icumcoeli = icumcoeli;
    ret.chartRuler = chartRuler;
    ret.partOfFortune = partOfFortune;
  } else {
    // Solar fallback: only sign-level facts are authoritative.
    const sun = chart.planets.find((p) => p.key === 'sun')!;
    const moon = chart.moon;
    ret.solarSign = {
      sun: sun.sign, sunLabel: sun.signLabel,
      moon: moon.sign, moonLabel: moon.signLabel,
    };
  }
  return ret;
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

// Aspects from FULL-precision longitudes. Round only for display/storage.
// ASPECT_DEFS (major aspects) is the locked set (A3); minor aspects are deferred
// per the reviewed contract and documented here.
export function buildAspects(bodies: BodyLong[]): AspectFact[] {
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
              weight: aspectWeight(def.type, orb),
            },
            provenance: [a.id, b.id],
          });
        }
      }
    }
  }
  return out;
}

// Documented aspect-weighting policy (shared with scores.ts). Used for synthesis
// scoring: supportive vs dynamic aspects, orb-weighted.
export function aspectWeight(type: string, orb: number): number {
  // Base by aspect nature (A3 major aspects):
  //  trine/sextile = supportive (+), conjunction = neutral-amplifier (0),
  //  square/opposition = dynamic/challenging (-).
  const base: Record<string, number> = { trine: 1, sextile: 0.6, conjunction: 0, square: -1, opposition: -0.8 };
  const b = base[type] ?? 0;
  // Orb factor: tighter orb => stronger effect (1 at exact, ~0 at max orb).
  const orbFactor = Math.max(0, 1 - orb / 8);
  return Math.round(b * orbFactor * 100) / 100;
}

// Detect deterministic patterns with REAL tightness (max orb among participants).
export function buildPatterns(chart: ChartData, aspects: AspectFact[], presentIds: Set<string>): PatternFact[] {
  const out: PatternFact[] = [];
  // Stellium: >=3 bodies in the same sign.
  const bySign: Record<string, string[]> = {};
  for (const p of chart.planets) {
    if (p.key === 'northnode' || p.key === 'southnode' || p.key === 'juno') continue;
    (bySign[p.sign] ||= []).push(p.label);
  }
  let idx = 0;
  for (const sign of Object.keys(bySign)) {
    if (bySign[sign].length >= 3) {
      const parts = bySign[sign];
      const ids = parts.map((l) => `natal.${l.toLowerCase()}.position`).filter((id) => presentIds.has(id));
      // Tightness = angular span (max-min degreeInSign across participants).
      const degs = parts.map((l) => (chart.planets.find((x) => x.label === l)!.degreeInSign));
      const tightness = round2(Math.max(...degs) - Math.min(...degs));
      out.push({
        id: `natal.pattern.stellium-${sign}-${idx}`,
        kind: 'pattern',
        source: 'derived-deterministic',
        display: `Stellium in ${getSign(sign)!.label}: ${parts.join(', ')} (span ${tightness}°)`,
        value: { name: 'Stellium', participants: parts, tightness },
        provenance: ids,
      });
      idx++;
    }
  }
  return out;
}

export async function computeVerifiedCommon(birth: { date: string; time?: string; location: string; unknownTime?: boolean; name?: string }): Promise<CommonDerived> {
  const chart = await computeChart({ name: birth.name, date: birth.date, time: birth.time, location: birth.location, unknownTime: !!birth.unknownTime });
  return buildCommonDerived(chart, !!birth.unknownTime);
}
