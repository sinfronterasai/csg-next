// Deterministic derived layer for VerifiedFactsV2. Reuses chartEngine (Swiss
// Ephemeris) and astrology reference data. No prose, no model math. Every derived
// fact carries provenance (the source fact ids it was computed from) and an exact
// renderer-owned display string.
//
// Source discipline (R2-B10): facts that ARE the raw Swiss Ephemeris output
// (planet positions, Ascendant, Midheaven) are 'swiss-ephemeris' ROOT facts with
// no provenance. Facts COMPUTED from those roots (Descendant, IC, South Node, Part
// of Fortune, chart ruler, tallies, aspects, patterns, rulers, occupants) are
// 'derived-deterministic' and MUST carry provenance to their input fact ids.

import { computeChart, normDeg, houseForLongitude, type ChartData, type PlanetPlacement, type HousePlacement } from '@/lib/chartEngine';
import { signFromLongitude, dignityFor, getSign, getPlanet, SIGNS } from '@/lib/astrology';
import { ASPECT_DEFS, angularDistance } from '@/lib/transit';
import type {
  CommonDerived, NodeValue, PositionValue, AspectFact, PatternFact, PatternValue, VerifiedFact,
  Dignity, FactSource, HouseCusp, RulerFact, HouseOccupants,
} from './types';

const DIGNITY_LABEL: Record<string, string> = {
  domicile: 'in domicile', exaltation: 'exalted', detriment: 'in detriment', fall: 'in fall',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function round2(n: number): number { return Math.round(n * 100) / 100; }

// Full-precision longitude retained for aspect math. display/storage round.
interface BodyLong {
  id: string; key: string; label: string; longitude: number; full: PlanetPlacement;
}

// T3-3: Locked aspect set from 00-shared-foundation.md.
// Major: conjunction, opposition, trine, square, sextile
// Minor: quincunx, semi-sextile, semi-square, sesquisquare
// Default orbs: luminaries (Sun+Moon) 10°, planets 8°, minor 2°
// Body-aware orb selection in buildAspects.
export const ASPECT_ORBS: { type: string; angle: number; orb: number; minor: boolean }[] = [
  { type: 'conjunction', angle: 0, orb: 8, minor: false },
  { type: 'sextile', angle: 60, orb: 8, minor: false },
  { type: 'square', angle: 90, orb: 8, minor: false },
  { type: 'trine', angle: 120, orb: 8, minor: false },
  { type: 'opposition', angle: 180, orb: 8, minor: false },
  // Minor aspects (locked 2° orb):
  { type: 'semi-sextile', angle: 30, orb: 2, minor: true },
  { type: 'semi-square', angle: 45, orb: 2, minor: true },
  { type: 'sesquisquare', angle: 135, orb: 2, minor: true },
  { type: 'quincunx', angle: 150, orb: 2, minor: true },
];

// Check if a body is a luminary (Sun or Moon)
function isLuminary(key: string): boolean {
  return key === 'sun' || key === 'moon';
}

// F4-10: luminary 10° when EITHER endpoint is a luminary (Sun or Moon)
function getOrbForBodies(def: typeof ASPECT_ORBS[0], bodyA: string, bodyB: string): number {
  if (def.minor) return 2; // All minor aspects use 2° orb
  // Major aspects: 10° if either endpoint is a luminary, 8° otherwise
  if (isLuminary(bodyA) || isLuminary(bodyB)) return 10;
  return 8;
}

function positionFact(id: string, key: string, label: string, longitude: number, house: number | null, retrograde: boolean, source: FactSource = 'swiss-ephemeris', provenance?: string[]): VerifiedFact {
  const { sign, degreeInSign } = signFromLongitude(longitude);
  const info = getPlanet(key) || { label, glyph: '•' };
  const dignity = dignityFor(key, sign.key) as Dignity;
  const houseStr = house != null ? ` in the ${ordinal(house)} house` : '';
  const retro = retrograde ? ' (retrograde)' : '';
  const dig = dignity ? `, ${DIGNITY_LABEL[dignity]}` : '';
  return {
    id, kind: 'position', source,
    display: `${label} at ${degreeInSign.toFixed(2)}° ${sign.label}${houseStr}${dig}${retro}`,
    value: { key, label, longitude: round2(longitude), degreeInSign: round2(degreeInSign), sign: sign.key, signLabel: sign.label, house, retrograde, dignity },
    provenance,
  };
}

function toNodeValue(fact: VerifiedFact): NodeValue {
  return { ...(fact.value as PositionValue), display: fact.display } as NodeValue;
}

// Resolve the ruling planet key for a sign (lowercased planet key).
function rulerKeyForSign(signKey: string): string {
  const sign = SIGNS.find((s) => s.key === signKey) || getSign(signKey as any);
  return (sign?.ruler || '').toLowerCase();
}

// Build a RulerFact for a house (by its cusp sign). Provenance = the ruler planet
// position fact + the cusp reference (surfaced as a cusp fact).
// F4-2: houseRuler derives all placement fields from the ruler planet's actual natal
// position fact, not the cusp sign. Fail closed if the ruler position is absent.
function houseRuler(cusp: HouseCusp, houseNum: number, cuspId: string, chart: ChartData): RulerFact {
  const rk = rulerKeyForSign(cusp.sign);
  const info = getPlanet(rk) || { label: rk };
  const rulerPlanet = chart.planets.find(p => p.key === rk);
  if (!rulerPlanet) throw new Error(`ruler planet ${rk} position not found for house ${houseNum}`);
  const { sign, degreeInSign } = signFromLongitude(rulerPlanet.longitude);
  const cond = dignityFor(rk, sign.key) as Dignity;
  const condition = cond ? DIGNITY_LABEL[cond] : `in ${sign.label}`;
  return {
    house: houseNum, ruler: rk, rulerLabel: info.label,
    sign: sign.key,
    degreeInSign: round2(degreeInSign),
    house_of_ruler: rulerPlanet.house ?? null,
    retrograde: rulerPlanet.retrograde,
    dignity: cond,
    condition,
    provenance: [cuspId, `natal.${rk}.position`],
  };
}

export async function buildCommonDerived(chart: ChartData, unknownTime: boolean = (chart.birth?.unknownTime ?? false)): Promise<CommonDerived> {
  // chart.planets already includes Juno (added to PLANET_BODIES in chartEngine), so
  // the initial map yields exactly one Juno fact. We must NOT push a second one
  // (R2-B1). Enforce unique IDs across every collection at the end.
  const bodies: BodyLong[] = chart.planets.map((p) => ({
    id: `natal.${p.key}.position`, key: p.key, label: p.label, longitude: p.longitude, full: p,
  }));

  const positions: VerifiedFact[] = chart.planets.map((p) =>
    positionFact(`natal.${p.key}.position`, p.key, p.label, p.longitude, p.house, p.retrograde, 'swiss-ephemeris', undefined),
  );
  const byKey: Record<string, VerifiedFact> = {};
  for (const f of positions) byKey[f.id] = f;

  const north = chart.planets.find((p) => p.key === 'northnode')!;
  const southLong = normDeg(north.longitude + 180);
  const southHouse = unknownTime ? null : houseForLongitude(southLong, chart.cusps);
  const southFact = positionFact('natal.southnode.position', 'southnode', 'South Node', southLong, southHouse, false, 'derived-deterministic', ['natal.northnode.position']);
  positions.push(southFact);
  byKey['natal.southnode.position'] = southFact;

  const northNode = toNodeValue(byKey['natal.northnode.position']);
  const southNode = toNodeValue(southFact);
  const junoNode = toNodeValue(byKey['natal.juno.position']); // single Juno fact (R2-B1)

  const moonBody = bodies.find((b) => b.key === 'moon');
  const timeSensitiveKeys = new Set<string>(['moon']);
  if (unknownTime) {
    delete byKey['natal.moon.position'];
    const idx = positions.findIndex((f) => f.id === 'natal.moon.position');
    if (idx >= 0) positions.splice(idx, 1);
    for (const f of positions) {
      const v = f.value as any;
      if (v.key !== 'sun' && v.key !== 'northnode' && v.key !== 'southnode' && v.key !== 'juno') {
        (v as any).uncertain = true;
        f.display += ' (approximate; birth time unknown)';
      }
    }
  }

  let partOfFortune: VerifiedFact | undefined;
  let chartRuler: VerifiedFact | undefined;
  let ascendant: NodeValue | undefined;
  let descendant: NodeValue | undefined;
  let midheaven: NodeValue | undefined;
  let icumcoeli: NodeValue | undefined;
  let houses: HouseCusp[] | undefined;
  let rulers: CommonDerived['rulers'];
  let occupants: HouseOccupants[] | undefined;
  let nodalRulers: CommonDerived['nodalRulers'];
  let pofLong: number | undefined; // F5-6: hoisted for aspect computation

  if (!unknownTime) {
    const ascLong = chart.ascendant.longitude;
    const moonLong = chart.moon.longitude;
    const sunLong = chart.sun.longitude;

    // Ascendant / Midheaven ARE Swiss Eph root output -> swiss-ephemeris, no provenance.
    const ascendantFact = positionFact('natal.ascendant.position', 'ascendant', 'Ascendant', chart.ascendant.longitude, 1, false, 'swiss-ephemeris');
    const midheavenFact = positionFact('natal.midheaven.position', 'midheaven', 'Midheaven', chart.midheaven.longitude, 10, false, 'swiss-ephemeris');
    // Descendant / IC are DERIVED (opposite points) -> derived-deterministic + provenance.
    const descendantFact = positionFact('natal.descendant.position', 'descendant', 'Descendant', normDeg(chart.ascendant.longitude + 180), 7, false, 'derived-deterministic', ['natal.ascendant.position']);
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

    // F4-3/F4-4: compute Part of Fortune exactly ONCE. Reuse identical full-precision
    // point for the fact, its house, and the aspect grid. Emit sect/formula metadata.
    // Day (Sun in houses 7-12): ASC + Moon - Sun
    // Night (Sun in houses 1-6): ASC + Sun - Moon
    const sunHouse = chart.sun.house;
    const isDay = sunHouse !== null && sunHouse >= 7 && sunHouse <= 12;
    const sect: 'day' | 'night' = isDay ? 'day' : 'night';
    const formula = isDay ? 'day:ASC+MOON-SUN' : 'night:ASC+SUN-MOON';
    pofLong = isDay
      ? normDeg(ascLong + moonLong - sunLong)
      : normDeg(ascLong + sunLong - moonLong);
    const pofHouse = houseForLongitude(pofLong, chart.cusps);
    const pofFact = positionFact('natal.partoffortune.position', 'partoffortune', 'Part of Fortune', pofLong, pofHouse, false, 'derived-deterministic', ['natal.ascendant.position', 'natal.moon.position', 'natal.sun.position']);
    // Inject sect/formula metadata into the POF value (F4-4)
    (pofFact.value as any).sect = sect;
    (pofFact.value as any).formula = formula;
    partOfFortune = pofFact;
    positions.push(partOfFortune);
    byKey['natal.partoffortune.position'] = partOfFortune;

    const ascSign = getSign(chart.ascendant.sign)!;
    const rulerKey = ascSign.ruler.toLowerCase();
    const rulerPlanet = chart.planets.find((p) => p.key === rulerKey)!;
    const rulerDignity = dignityFor(rulerKey, rulerPlanet.sign);
    const rulerCondition = rulerDignity ? DIGNITY_LABEL[rulerDignity] : 'in no special dignity';
    chartRuler = {
      id: 'common.chartRuler', kind: 'point', source: 'derived-deterministic',
      display: `Chart ruler ${getPlanet(rulerKey)!.label} at ${rulerPlanet.degreeInSign.toFixed(2)}° ${rulerPlanet.signLabel}, ${rulerCondition}`,
      value: { planet: rulerKey, label: getPlanet(rulerKey)!.label, sign: rulerPlanet.sign, condition: rulerCondition },
      provenance: ['natal.ascendant.position', `natal.${rulerKey}.position`],
    };

    // House cusps (R2-B6) — 12 cusps surfaced as HouseCusp facts.
    houses = chart.cusps.slice(1, 13).map((c, i) => {
      const num = i + 1;
      const { sign } = signFromLongitude(c);
      return { num, cuspLongitude: round2(c), sign: sign.key, signLabel: sign.label };
    });
    const cuspFacts = houses.map((h) => ({ id: `common.cusp.${h.num}`, fact: h }));
    for (const cf of cuspFacts) byKey[cf.id] = { id: cf.id, kind: 'point', source: 'derived-deterministic', display: `House ${cf.fact.num} cusp at ${signFromLongitude(cf.fact.cuspLongitude).degreeInSign.toFixed(2)}° ${cf.fact.signLabel}`, value: cf.fact, provenance: [] } as VerifiedFact;

    // Rulers: 7th (DSC), 2nd, 6th, 10th (MC).
    const dscCusp = houses[6]; // house 7
    const secondCusp = houses[1];
    const sixthCusp = houses[5];
    const tenthCusp = houses[9];
    rulers = {
      dsc: houseRuler(dscCusp, 7, `common.cusp.7`, chart),
      second: houseRuler(secondCusp, 2, `common.cusp.2`, chart),
      sixth: houseRuler(sixthCusp, 6, `common.cusp.6`, chart),
      tenth: houseRuler(tenthCusp, 10, `common.cusp.10`, chart),
    };

    // Occupants: bodies in each house.
    occupants = houses.map((h) => ({
      house: h.num,
      occupants: chart.planets
        .filter((p) => p.house === h.num)
        .map((p) => ({ body: p.key, label: p.label, positionId: `natal.${p.key}.position` })),
    }));

    // F4-1: nodal rulers resolved from the ACTUAL ruler planet position (not node sign).
    const nRk = rulerKeyForSign(northNode.sign);
    const sRk = rulerKeyForSign(southNode.sign);
    const nRulerPlanet = chart.planets.find(p => p.key === nRk);
    const sRulerPlanet = chart.planets.find(p => p.key === sRk);
    if (!nRulerPlanet || !sRulerPlanet) throw new Error('nodal ruler planet position not found');
    const nRulerSign = signFromLongitude(nRulerPlanet.longitude);
    const sRulerSign = signFromLongitude(sRulerPlanet.longitude);
    const nCond = dignityFor(nRk, nRulerSign.sign.key) as Dignity;
    const sCond = dignityFor(sRk, sRulerSign.sign.key) as Dignity;
    nodalRulers = {
      north: {
        house: 0, ruler: nRk, rulerLabel: getPlanet(nRk)!.label,
        sign: nRulerSign.sign.key,
        degreeInSign: round2(nRulerSign.degreeInSign),
        house_of_ruler: nRulerPlanet.house ?? null,
        retrograde: nRulerPlanet.retrograde,
        dignity: nCond,
        condition: nCond ? DIGNITY_LABEL[nCond] : `in ${nRulerSign.sign.label}`,
        provenance: ['natal.northnode.position', `natal.${nRk}.position`],
      },
      south: {
        house: 0, ruler: sRk, rulerLabel: getPlanet(sRk)!.label,
        sign: sRulerSign.sign.key,
        degreeInSign: round2(sRulerSign.degreeInSign),
        house_of_ruler: sRulerPlanet.house ?? null,
        retrograde: sRulerPlanet.retrograde,
        dignity: sCond,
        condition: sCond ? DIGNITY_LABEL[sCond] : `in ${sRulerSign.sign.label}`,
        provenance: ['natal.southnode.position', `natal.${sRk}.position`],
      },
    };
  }

  let moonPhase: VerifiedFact | undefined;
  if (!unknownTime) {
    const elong = normDeg(chart.moon.longitude - chart.sun.longitude);
    const phase = round2(elong / 360);
    moonPhase = {
      id: 'common.moonPhase', kind: 'phase', source: 'derived-deterministic',
      display: `Moon phase ${moonPhaseLabel(phase)} (${phase.toFixed(2)} of cycle)`,
      value: { phase, label: moonPhaseLabel(phase) },
      provenance: ['natal.moon.position', 'natal.sun.position'],
    };
  }

  // Aspects: FULL-precision longitudes, major + minor set (R2-B7). Under known-time,
  // include the four angles so MC/ascendant aspects resolve (R2-B6). Under
  // unknown-time, drop Moon-involving aspects and angles (absent).
  const aspectBodies = bodies.filter((b) => !(unknownTime && timeSensitiveKeys.has(b.key)));
  if (!unknownTime && ascendant && descendant && midheaven && icumcoeli) {
    // Include the angles AND the derived points (South Node, Part of Fortune) in
    // the aspect computation (R2-B13) so MC/nodal/POF aspects can actually exist
    // for vocation (MC aspects) and karmic (South-Node aspects) evidence.
    const southLong = normDeg(northNode.longitude + 180);
    // F4-3: reuse the IDENTICAL full-precision pofLong computed above (no recompute)
    const extra: BodyLong[] = [
      { id: 'natal.ascendant.position', key: 'ascendant', label: 'Ascendant', longitude: chart.ascendant.longitude, full: chart.planets[0] },
      { id: 'natal.descendant.position', key: 'descendant', label: 'Descendant', longitude: normDeg(chart.ascendant.longitude + 180), full: chart.planets[0] },
      { id: 'natal.midheaven.position', key: 'midheaven', label: 'Midheaven', longitude: chart.midheaven.longitude, full: chart.planets[0] },
      { id: 'natal.icumcoeli.position', key: 'icumcoeli', label: 'Imum Coeli', longitude: normDeg(chart.midheaven.longitude + 180), full: chart.planets[0] },
      { id: 'natal.southnode.position', key: 'southnode', label: 'South Node', longitude: southLong, full: chart.planets[0] },
      // F5-6: reuse the SAME full-precision pofLong variable (no rounding) for aspect math
      { id: 'natal.partoffortune.position', key: 'partoffortune', label: 'Part of Fortune', longitude: pofLong!, full: chart.planets[0] },
    ];
    aspectBodies.push(...extra);
  }
  const aspects: AspectFact[] = buildAspects(aspectBodies);

  // Correct minimum-orb top aspect per body (R2-B2): track current min directly.
  const topMap: Record<string, string> = {};
  const topOrb: Record<string, number> = {};
  for (const a of aspects) {
    for (const k of [a.value.bodyA, a.value.bodyB]) {
      const cur = topMap[k];
      if (!cur || a.value.orb < topOrb[cur]) { topMap[k] = a.id; topOrb[topMap[k]] = a.value.orb; }
    }
  }
  // Surface as a single stable citable VerifiedFact (R2-B10) — not a raw alias map.
  const topValue = Object.entries(topMap).map(([body, aspectId]) => ({ body, aspectId, orb: topOrb[aspectId] }));
  const topAspectByBody: VerifiedFact = {
    id: 'common.topAspectByBody', kind: 'meta', source: 'derived-deterministic',
    display: `Top aspect per body (${topValue.length} bodies)`,
    value: topValue, provenance: Object.values(topMap),
  };

  // Element / modality tallies. Under unknown-time the Moon (noon) is excluded
  // (R2-B5): tally only the nine non-time-sensitive planets.
  const TEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const tallyKeys = unknownTime ? TEN.filter((k) => k !== 'moon') : TEN;
  const elements: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const key of tallyKeys) {
    const p = chart.planets.find((x) => x.key === key);
    if (!p) continue;
    const sign = getSign(p.sign)!;
    elements[sign.element] += 1;
    modalities[sign.modality] += 1;
  }
  const presentPlanetIds = positions.filter((f) => f.kind === 'position' && tallyKeys.includes((f.value as any).key)).map((f) => f.id);
  const elementsFact: VerifiedFact = { id: 'common.elements', kind: 'tally', source: 'derived-deterministic', display: `Element tally — Fire ${elements.Fire}, Earth ${elements.Earth}, Air ${elements.Air}, Water ${elements.Water}`, value: elements, provenance: presentPlanetIds };
  const modalitiesFact: VerifiedFact = { id: 'common.modalities', kind: 'tally', source: 'derived-deterministic', display: `Modality tally — Cardinal ${modalities.Cardinal}, Fixed ${modalities.Fixed}, Mutable ${modalities.Mutable}`, value: modalities, provenance: presentPlanetIds };

  const presentIds = new Set(positions.map((f) => f.id));
  const patterns = buildPatterns(chart, aspects, presentIds);

  // Unique-ID invariant across all collections (R2-B1).
  assertUniqueIds(positions, aspects, patterns, [chartRuler, moonPhase, elementsFact, modalitiesFact].filter(Boolean) as VerifiedFact[]);

  const ret: CommonDerived = {
    positions, northNode, southNode, juno: junoNode, isSolarFallback: unknownTime,
    moonPhase: moonPhase!, elements: elementsFact, modalities: modalitiesFact,
    houses, rulers, occupants, nodalRulers,
    aspects, topAspectByBody, patterns,
  };
  if (!unknownTime) {
    ret.ascendant = ascendant; ret.descendant = descendant; ret.midheaven = midheaven; ret.icumcoeli = icumcoeli;
    ret.chartRuler = chartRuler; ret.partOfFortune = partOfFortune;
  } else {
    // Solar fallback: only expose the Moon sign if it is INVARIANT across the whole
    // local birth date (R2-B5). Otherwise omit it (do not fabricate a noon sign).
    const sunP = chart.planets.find((p) => p.key === 'sun')!;
    const moon = await moonSignInvariant(chart);
    ret.solarSign = { sun: sunP.sign, sunLabel: sunP.signLabel };
    if (moon) ret.solarSign.moon = { sign: moon.sign, signLabel: moon.signLabel, invariant: true };
  }
  return ret;
}

// Compute Moon sign at start and end of the local birth date; return the sign only
// if identical (invariant). Otherwise returns null so the caller omits the Moon sign.
async function moonSignInvariant(chart: ChartData): Promise<{ sign: string; signLabel: string } | null> {
  try {
    const start = await computeChart({ date: chart.birth.date, time: '00:00', location: chart.birth.location });
    const end = await computeChart({ date: chart.birth.date, time: '23:59', location: chart.birth.location });
    if (start.moon.sign === end.moon.sign) return { sign: start.moon.sign, signLabel: start.moon.signLabel };
    return null;
  } catch {
    return null;
  }
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

// F4-11/F5-7: named thresholds for aspect determination (full-precision error)
export const EXACT_ASPECT_EPSILON = 0.1; // degrees; exact aspect threshold
export const TIGHT_ASPECT_THRESHOLD = 1.0; // degrees; tight aspect threshold

// Aspects from FULL-precision longitudes, locked major + minor set (T3-3).
// Body-aware orb selection: luminaries 10°, planets 8°, minor 2°.
// Output sorted by ascending orb.
export function buildAspects(bodyList: BodyLong[]): AspectFact[] {
  const out: AspectFact[] = [];
  for (let i = 0; i < bodyList.length; i++) {
    for (let j = i + 1; j < bodyList.length; j++) {
      const a = bodyList[i]; const b = bodyList[j];
      if (a.key === b.key) continue;
      for (const def of ASPECT_ORBS) {
        const dist = angularDistance(a.longitude, b.longitude);
        // F5-6: retain FULL-precision error through all math; round only the display orb
        const error = Math.min(Math.abs(dist - def.angle), Math.abs(dist - (360 - def.angle)));
        const orbLimit = getOrbForBodies(def, a.key, b.key);
        if (error <= orbLimit) {
          // F4-11/F5-7: exact + tight from named full-precision thresholds
          const exact = error < EXACT_ASPECT_EPSILON;
          const tight = error < TIGHT_ASPECT_THRESHOLD;
          const orb = round2(error);
          // F5-8: canonicalize endpoints (sorted by key) for stable id/provenance/values
          const [first, second] = a.key <= b.key ? [a, b] : [b, a];
          const id = `natal.aspect.${first.key}-${second.key}-${def.type}`;
          out.push({
            id, kind: 'aspect', source: 'derived-deterministic',
            display: `${first.label} ${def.type} ${second.label} (orb ${orb}°)`,
            // F5-8: bodyA/bodyB canonicalized (first.key <= second.key)
            value: { bodyA: first.key, bodyB: second.key, aspectType: def.type, orb, tight, exact, bodyALabel: first.label, bodyBLabel: second.label, weight: aspectWeight(def.type, orb), minor: def.minor },
            // F5-2/F5-8: provenance = exact endpoint position ids, canonical order
            provenance: [first.id, second.id],
          });
        }
      }
    }
  }
  // T3-3: Sort by ascending orb with stable tie-breaking (by type, then bodyA, then bodyB)
  return out.sort((a, b) => {
    if (a.value.orb !== b.value.orb) return a.value.orb - b.value.orb;
    if (a.value.aspectType !== b.value.aspectType) return a.value.aspectType.localeCompare(b.value.aspectType);
    if (a.value.bodyA !== b.value.bodyA) return a.value.bodyA.localeCompare(b.value.bodyA);
    return a.value.bodyB.localeCompare(b.value.bodyB);
  });
}

export function aspectWeight(type: string, orb: number): number {
  const base: Record<string, number> = { trine: 1, sextile: 0.6, conjunction: 0, square: -1, opposition: -0.8, 'semi-sextile': 0.2, 'semi-square': -0.4, sesquisquare: -0.4, quincunx: -0.3 };
  const b = base[type] ?? 0;
  const orbFactor = Math.max(0, 1 - orb / 8);
  return Math.round(b * orbFactor * 100) / 100;
}

// Locked pattern engine (R2-B11): stellium, grand trine, T-square, yod.
// Tightness semantics are explicit per type (see types.ts PatternValue):
//  - stellium: angular span (max-min degreeInSign across participants).
//  - grandTrine / tSquare / yod: max orb among the constituent aspects.
// Bodies considered: all chart planets (nodes/POF/angles omitted from patterns,
// which is the standard convention; aspects among them are still computed above).
export function buildPatterns(chart: ChartData, aspects: AspectFact[], presentIds: Set<string>): PatternFact[] {
  const out: PatternFact[] = [];
  const planets = chart.planets.filter((p) => !['northnode', 'southnode', 'juno'].includes(p.key));
  const longOf = (key: string) => planets.find((p) => p.key === key)?.longitude ?? null;
  const labelOf = (key: string) => planets.find((p) => p.key === key)?.label ?? key;
  const aspectBetween = (a: string, b: string, type: string) =>
    aspects.find((x) => x.value.aspectType === type &&
      ((x.value.bodyA === a && x.value.bodyB === b) || (x.value.bodyA === b && x.value.bodyB === a)));

  // --- Stellium: 3+ planets in the same sign ---
  const bySign: Record<string, string[]> = {};
  for (const p of planets) (bySign[p.sign] ||= []).push(p.label);
  let sIdx = 0;
  for (const sign of Object.keys(bySign)) {
    if (bySign[sign].length >= 3) {
      const parts = bySign[sign];
      const ids = parts.map((l) => `natal.${l.toLowerCase()}.position`).filter((id) => presentIds.has(id));
      const degs = parts.map((l) => (planets.find((x) => x.label === l)!.degreeInSign));
      const tightness = round2(Math.max(...degs) - Math.min(...degs));
      out.push({
        id: `natal.pattern.stellium-${sign}-${sIdx}`, kind: 'pattern', source: 'derived-deterministic',
        display: `Stellium in ${getSign(sign as any)!.label}: ${parts.join(', ')} (span ${tightness}°)`,
        value: { name: 'Stellium', participants: parts, tightness, tightnessSemantics: 'angular-span' }, provenance: ids,
      });
      sIdx++;
    }
  }

  // --- Grand Trine: 3 bodies mutually trine (each pair within trine orb) ---
  // --- T-square: 2 opposite + a third square to BOTH ---
  // --- Yod: 2 sextile + a third quincunx (150°) to BOTH ---
  const keys = planets.map((p) => p.key);
  // F4-12: canonicalize participant keys (sorted) for stable ID across all permutations,
  // while preserving semantic roles (base/apex) in the structured value.
  // F5-8: canonicalize participants (sorted keys) for stable id + value + display.
  // Semantic roles (base pair + apex) are preserved as typed fields, not injection.
  const pushPattern = (name: 'GrandTrine' | 'TSquare' | 'Yod', trio: string[], orbs: number[], roles?: { base: string[]; apex: string }) => {
    const sorted = [...trio].sort();
    const labels = sorted.map(labelOf);
    const ids = sorted.map((k) => `natal.${k}.position`).filter((id) => presentIds.has(id));
    const tightness = round2(Math.max(...orbs));
    const canonical = sorted.join('-');
    const value: PatternValue = {
      name, participants: labels, tightness, tightnessSemantics: 'max-orb',
      roles: roles ? { base: [...roles.base].sort(), apex: roles.apex } : undefined,
    };
    out.push({
      id: `natal.pattern.${name.toLowerCase()}-${canonical}`,
      kind: 'pattern', source: 'derived-deterministic',
      display: `${name}: ${labels.join(', ')} (max orb ${tightness}°)`,
      value, provenance: ids,
    });
  };
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      for (let k = j + 1; k < keys.length; k++) {
        const trio = [keys[i], keys[j], keys[k]];
        // Grand trine: all three pairs trine.
        const g = [aspectBetween(trio[0], trio[1], 'trine'), aspectBetween(trio[1], trio[2], 'trine'), aspectBetween(trio[0], trio[2], 'trine')];
        if (g.every(Boolean)) pushPattern('GrandTrine', trio, g.map((x) => (x!.value as any).orb));
        // T3-2: T-square and Yod detection must be role-order independent.
        // Check all three pairs for the base aspect, not just trio[0]-trio[1].

        // T-square: find opposition pair, third body squares both
        const pairs = [[0,1,2], [0,2,1], [1,2,0]]; // [baseA, baseB, apex]
        for (const [a, b, apex] of pairs) {
          const op = aspectBetween(trio[a], trio[b], 'opposition');
          const sq1 = aspectBetween(trio[apex], trio[a], 'square');
          const sq2 = aspectBetween(trio[apex], trio[b], 'square');
          if (op && sq1 && sq2) {
            pushPattern('TSquare', trio, [op.value.orb, sq1.value.orb, sq2.value.orb], { base: [trio[a], trio[b]], apex: trio[apex] });
            break;
          }
        }

        // Yod: find sextile base, third body quincunx to both
        for (const [a, b, apex] of pairs) {
          const sext = aspectBetween(trio[a], trio[b], 'sextile');
          const q1 = aspectBetween(trio[apex], trio[a], 'quincunx') || aspectBetween(trio[apex], trio[a], 'inconjunct');
          const q2 = aspectBetween(trio[apex], trio[b], 'quincunx') || aspectBetween(trio[apex], trio[b], 'inconjunct');
          if (sext && q1 && q2) {
            pushPattern('Yod', trio, [sext.value.orb, q1.value.orb, q2.value.orb], { base: [trio[a], trio[b]], apex: trio[apex] });
            break;
          }
        }
      }
    }
  }
  return out;
}

// Enforce unique fact IDs across every collection (R2-B1).
function assertUniqueIds(...collections: VerifiedFact[][]): void {
  const seen = new Set<string>();
  for (const col of collections) {
    for (const f of col) {
      if (seen.has(f.id)) throw new Error(`duplicate fact id: ${f.id}`);
      seen.add(f.id);
    }
  }
}

export async function computeVerifiedCommon(birth: { date: string; time?: string; location: string; unknownTime?: boolean; name?: string }): Promise<CommonDerived> {
  const chart = await computeChart({ name: birth.name, date: birth.date, time: birth.time, location: birth.location, unknownTime: !!birth.unknownTime });
  return buildCommonDerived(chart, !!birth.unknownTime);
}
