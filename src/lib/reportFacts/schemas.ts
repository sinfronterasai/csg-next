// Per-report required-field contracts + deterministic preflight validator + fact
// resolution validator.
//
// R2-B3: validation is VALUE/SHAPE based, not mere key existence. A field present
// but undefined / null / empty / wrong-type / out-of-range / missing drivers is
// treated as missing. Malformed-present inputs are caught (see tests).
//
// R2-B4: every locked A4 report-specific evidence bundle is required and shape
// validated. Fields built in later phases are DECLARED and fail closed.

import type { ReportType, VerifiedFactsV2, PreflightResult, VerifiedFact } from './types';
import type { ScoreBand } from './scores';
import { ASPECT_ORBS } from './derived';
import { dignityFor, signFromLongitude, getPlanet, SIGNS } from '@/lib/astrology';

// Mirror of derived.ts DIGNITY_LABEL (not exported there).
const DIGNITY_LABEL: Record<string, string> = {
  domicile: 'in domicile', exaltation: 'exalted', detriment: 'in detriment', fall: 'in fall',
};

// ---- fact accessors ----
function factById(v2: VerifiedFactsV2, id: string): VerifiedFact | undefined {
  const key = id.startsWith('facts.') ? id.slice('facts.'.length) : id;
  return v2.facts[key];
}
function commonField(v2: VerifiedFactsV2, name: string): any {
  return (v2.common as any)[name];
}
function reportField(v2: VerifiedFactsV2, path: string): any {
  return path.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), v2.reportData);
}

// ---- shape validators ----
// Accepts either a VerifiedFact (reads .value) or a bare PositionValue/NodeValue.
function isPositionFact(f: any): string | null {
  if (!f) return 'absent';
  const v = f.kind === 'position' ? f.value : f; // facts wrap value; common.* fields are bare PositionValue
  if (!v || typeof v !== 'object') return 'not a position value';
  // F6-2: longitude must be a real ecliptic longitude in [0,360).
  if (typeof v.longitude !== 'number' || v.longitude < 0 || v.longitude >= 360) return 'longitude out of range';
  if (typeof v.degreeInSign !== 'number' || v.degreeInSign < 0 || v.degreeInSign >= 30) return 'degreeInSign out of range';
  if (typeof v.sign !== 'string' || !v.sign) return 'missing sign';
  if (typeof v.key !== 'string' || !v.key) return 'missing key';
  if (typeof v.label !== 'string' || !v.label) return 'missing label';
  // sign/degree must be derived consistently from longitude
  const idx = Math.floor(v.longitude / 30) % 12;
  if (SIGNS[idx].key !== v.sign) return `sign ${v.sign} inconsistent with longitude ${v.longitude} (expected ${SIGNS[idx].key})`;
  if (Math.abs((v.longitude - idx * 30) - v.degreeInSign) > 0.001) return `degreeInSign ${v.degreeInSign} inconsistent with longitude ${v.longitude}`;
  if (typeof v.retrograde !== 'boolean') return 'retrograde must be boolean';
  if (!['domicile','exaltation','detriment','fall',null].includes(v.dignity)) return 'invalid dignity';
  if (v.house != null && (typeof v.house !== 'number' || v.house < 1 || v.house > 12)) return 'house out of range';
  return null;
}
function isScoreBand(v: any): string | null {
  if (!v || typeof v !== 'object') return 'absent';
  if (typeof v.value !== 'number' || v.value < 40 || v.value > 100) return `value out of 40-100 (${(v as any).value})`;
  if (v.band !== 'low' && v.band !== 'moderate' && v.band !== 'high') return 'missing band';
  if (typeof v.label !== 'string' || !v.label) return 'missing label';
  if (!Array.isArray(v.drivers)) return 'drivers not array';
  if (v.drivers.length === 0 && !/constant baseline/.test(v.rule)) return 'empty drivers without constant-baseline rule';
  if (typeof v.rule !== 'string' || !v.rule) return 'missing rule';
  return null;
}
const ALLOWED_ASPECT_TYPES = new Set<string>(ASPECT_ORBS.map((a) => a.type));
function isAspectEvidence(v: any): string | null {
  if (!v || typeof v !== 'object') return 'absent';
  if (typeof v.pair !== 'string' || !v.pair) return 'missing pair';
  if (v.aspectType !== null && typeof v.aspectType !== 'string') return 'bad aspectType';
  if (v.aspectType !== null && !ALLOWED_ASPECT_TYPES.has(v.aspectType)) return `invalid aspectType: ${v.aspectType}`;
  // T3-6: aspectType null iff aspectId null
  if ((v.aspectType === null) !== (v.aspectId === null || v.aspectId === undefined)) {
    return 'aspectType/aspectId null mismatch';
  }
  // T3-6: aspectId must be a non-empty string when present
  if (v.aspectId !== null && v.aspectId !== undefined) {
    if (typeof v.aspectId !== 'string' || !v.aspectId) return 'invalid aspectId';
  }
  if (!Array.isArray(v.provenance) || v.provenance.length === 0) return 'missing provenance';
  // T3-6: provenance must be non-empty strings
  for (const p of v.provenance) {
    if (typeof p !== 'string' || !p) return 'invalid provenance entry';
  }
  return null;
}

// F5-2: validate that a non-null aspectId resolves to a real aspect fact whose
// endpoints and type match the evidence object, AND that provenance matches the
// cited aspectId exactly (no unrelated substitute).
// F6-12: expected endpoints are structured [bodyA, bodyB], NOT recovered from a pair string.
function validateAspectId(v2: VerifiedFactsV2, ev: any, expectedEndpoints: [string, string]): string | null {
  const [a, b] = expectedEndpoints;
  const expectedPair = `${a}-${b}`;
  if (ev.aspectId === null || ev.aspectId === undefined) {
    // No-hit evidence: provenance must be the two canonical endpoint position ids.
    if (ev.aspectType !== null) return 'no-hit evidence must have null aspectType';
    const expect = [`natal.${a}.position`, `natal.${b}.position`].sort();
    const got = [...(ev.provenance || [])].sort();
    if (JSON.stringify(got) !== JSON.stringify(expect)) return `no-hit provenance ${got} != canonical endpoints ${expect}`;
    return null;
  }
  const fact = factById(v2, ev.aspectId);
  if (!fact || fact.kind !== 'aspect') return `aspectId ${ev.aspectId} does not resolve to an aspect fact`;
  const av: any = fact.value;
  const pair = `${av.bodyA}-${av.bodyB}`;
  const rev = `${av.bodyB}-${av.bodyA}`;
  if (pair !== expectedPair && rev !== expectedPair) return `aspectId endpoints ${pair} != expected ${expectedPair}`;
  if (av.aspectType !== ev.aspectType) return `aspectId type ${av.aspectType} != evidence ${ev.aspectType}`;
  // F6-4: hit provenance MUST EQUAL [aspectId] exactly. No extras, no missing.
  if (!Array.isArray(ev.provenance) || ev.provenance.length !== 1 || ev.provenance[0] !== ev.aspectId) {
    return `provenance must equal [${ev.aspectId}] exactly, got ${JSON.stringify(ev.provenance)}`;
  }
  return null;
}

// F4-5/F5-1: validate exact named pair + real aspect endpoints/types for ANY report.
// F6-12: expectedEndpoints is the structured [bodyA, bodyB] pair.
function validateNamedAspect(v2: VerifiedFactsV2, ev: any, expectedEndpoints: [string, string]): string | null {
  const base = isAspectEvidence(ev);
  if (base) return base;
  const pair = expectedEndpoints.join('-');
  if (ev.pair !== pair) return `pair ${ev.pair} != expected ${pair}`;
  const aid = validateAspectId(v2, ev, expectedEndpoints);
  if (aid) return aid;
  return null;
}

// F4-6/F5-3: validate a semantic evidence-ID array: every member must resolve to a
// real fact of the expected kind (aspect or position), with no duplicates.
// For aspects, optionally check aspectType and body involvement.
function validateIdArray(
  v2: VerifiedFactsV2, arr: any, expectKind: string = 'aspect', expectType?: string, mustInvolve?: string[],
): string | null {
  if (!Array.isArray(arr)) return 'not an array';
  const seen = new Set<string>();
  for (const id of arr) {
    if (typeof id !== 'string' || !id) return `invalid id entry: ${id}`;
    if (seen.has(id)) return `duplicate id: ${id}`;
    seen.add(id);
    const fact = factById(v2, id);
    if (!fact || fact.kind !== expectKind) return `dangling or non-${expectKind} id: ${id}`;
    // Only check aspect-specific properties if it's actually an aspect
    if (expectKind === 'aspect') {
      const av: any = fact.value;
      if (expectType && av.aspectType !== expectType) return `id ${id} type ${av.aspectType} != ${expectType}`;
      if (mustInvolve && mustInvolve.length > 0) {
        const involves = mustInvolve.some((b) => av.bodyA.includes(b) || av.bodyB.includes(b));
        if (!involves) return `id ${id} (${av.bodyA}-${av.bodyB}) does not involve ${mustInvolve.join('/')}`;
      }
    }
  }
  return null;
}

// F6-9: derive the complete authoritative set of aspect ids from canonical aspects,
// then require a semantic evidence array to EQUAL that set exactly (no omissions,
// extras, duplicates, or contradictions).
function authoritativeAspectSet(v2: VerifiedFactsV2, predicate: (av: any) => boolean): string[] {
  const all: any[] = commonField(v2, 'aspects') || [];
  return all.filter((a: any) => predicate(a.value)).map((a: any) => a.id).sort();
}
function requireExactAspectSet(got: any, expected: string[], label: string): string | null {
  if (!Array.isArray(got)) return `${label}: not an array`;
  const g = [...got].sort();
  if (g.length !== expected.length) return `${label}: count ${g.length} != authoritative ${expected.length} (omission/extra/duplicate)`;
  if (JSON.stringify(g) !== JSON.stringify(expected)) return `${label}: set differs from authoritative complete set`;
  return null;
}

// F6-3: full RulerFact validator that cross-checks every field against the cited
// ruler planet placement fact and the expected cusp/node provenance.
function isRulerFact(v: any, cuspId: string, rulerPositionId: string, v2: VerifiedFactsV2): string | null {
  if (!v || typeof v !== 'object') return 'absent';
  if (typeof v.ruler !== 'string' || !v.ruler) return 'missing ruler key';
  if (typeof v.sign !== 'string' || !v.sign) return 'missing sign';
  if (typeof v.degreeInSign !== 'number' || v.degreeInSign < 0 || v.degreeInSign >= 30) return 'degreeInSign out of range';
  if (v.house_of_ruler !== null && (typeof v.house_of_ruler !== 'number' || v.house_of_ruler < 1 || v.house_of_ruler > 12)) return 'ruler house out of range';
  if (typeof v.retrograde !== 'boolean') return 'retrograde must be boolean';
  if (!['domicile','exaltation','detriment','fall',null].includes(v.dignity)) return 'invalid dignity';
  if (typeof v.condition !== 'string' || !v.condition) return 'missing condition';
  // F6-3: ruler key must be the planet of the ruler-position fact.
  const expectedRuler = rulerPositionId.split('.')[1];
  if (v.ruler !== expectedRuler) return `ruler ${v.ruler} != expected ${expectedRuler} from ${rulerPositionId}`;
  // Cross-check placement fields against the canonical ruler-position fact.
  const rpos = factById(v2, rulerPositionId);
  if (!rpos || rpos.kind !== 'position') return `ruler placement ${rulerPositionId} missing`;
  const rp: any = rpos.value;
  if (v.sign !== rp.sign) return `ruler sign ${v.sign} != ${rp.sign}`;
  if (Math.abs(v.degreeInSign - rp.degreeInSign) > 0.01) return `ruler degree ${v.degreeInSign} != ${rp.degreeInSign}`;
  if (v.house_of_ruler !== rp.house) return `ruler house ${v.house_of_ruler} != ${rp.house}`;
  if (v.retrograde !== rp.retrograde) return `ruler retrograde ${v.retrograde} != ${rp.retrograde}`;
  const expDignity = dignityFor(v.ruler, rp.sign) as any;
  if (v.dignity !== expDignity) return `ruler dignity ${v.dignity} != ${expDignity}`;
  const expCondition = expDignity ? DIGNITY_LABEL[expDignity] : `in ${rp.signLabel}`;
  if (v.condition !== expCondition) return `ruler condition ${v.condition} != ${expCondition}`;
  // Provenance must equal exactly [cuspId, rulerPositionId].
  const expProv = [cuspId, rulerPositionId].sort();
  const got = [...(v.provenance || [])].sort();
  if (JSON.stringify(got) !== JSON.stringify(expProv)) return `ruler provenance ${got} != ${expProv}`;
  return null;
}

// F5-5: Part-of-Fortune validator (position shape + sect/formula + provenance).
// v may be a VerifiedFact wrapper (kind:'position', value holds sect/formula) or a
// bare position object. Unwrap before reading sect/formula; read provenance from the
// outer wrapper when present.
function isPartOfFortune(v2: VerifiedFactsV2, v: any): string | null {
  if (!v || typeof v !== 'object') return 'absent';
  const value = v.kind === 'position' ? v.value : v;
  const posErr = isPositionFact(v);
  if (posErr) return `position: ${posErr}`;
  if (value.sect !== 'day' && value.sect !== 'night') return `invalid sect: ${value.sect}`;
  const expectedFormula = value.sect === 'day' ? 'day:ASC+MOON-SUN' : 'night:ASC+SUN-MOON';
  if (value.formula !== expectedFormula) return `formula ${value.formula} != ${expectedFormula}`;
  const prov = ['natal.ascendant.position', 'natal.moon.position', 'natal.sun.position'].sort();
  const got = [...(v.provenance || value.provenance || [])].sort();
  if (JSON.stringify(got) !== JSON.stringify(prov)) return `POF provenance ${got} != ASC/Sun/Moon`;
  return null;
}

interface FieldCheck { path: string; check: (v2: VerifiedFactsV2) => string | null; }

// ---- common position facts (must be valid PositionValue shapes) ----
const COMMON_POSITION_FIELDS: FieldCheck[] = [
  'common.ascendant', 'common.descendant', 'common.midheaven', 'common.icumcoeli',
  'common.northNode', 'common.southNode', 'common.juno',
].map((p) => ({ path: p, check: (v2) => isPositionFact(commonField(v2, p.replace('common.', '')) as any) }));
// chartRuler / partOfFortune / moonPhase / tallies are VerifiedFacts (not NodeValue)
const COMMON_POINT_FIELDS: FieldCheck[] = [
  'common.chartRuler', 'common.moonPhase', 'common.elements', 'common.modalities',
].map((p) => ({ path: p, check: (v2) => (commonField(v2, p.replace('common.', '')) ? null : 'absent') }));

// F6-2: every known-time report ledger must carry a fully validated POF fact and
// consistent common positions. Runs for all report types (skip if unknown-time).
const COMMON_CONSISTENCY: FieldCheck = {
  path: 'common.* (POF + position consistency)',
  check: (v2) => {
    // Unknown-time: ascendant is absent; skip common consistency (already fail-closed).
    if (!v2.common.ascendant) return null;
    const pairs: [string, string][] = [
      ['ascendant', 'natal.ascendant.position'],
      ['descendant', 'natal.descendant.position'],
      ['midheaven', 'natal.midheaven.position'],
      ['icumcoeli', 'natal.icumcoeli.position'],
      ['northNode', 'natal.northnode.position'],
      ['southNode', 'natal.southnode.position'],
      ['juno', 'natal.juno.position'],
      ['partOfFortune', 'natal.partoffortune.position'],
    ];
    for (const [alias, fid] of pairs) {
      const cf: any = commonField(v2, alias);
      const ff = factById(v2, fid);
      if (!cf || !ff) return `${alias} missing`;
      const cv = cf.kind === 'position' ? cf.value : cf;
      const fv: any = ff.value;
      if (Math.abs((cv.longitude ?? 0) - (fv.longitude ?? 0)) > 0.001) return `${alias} longitude ${cv.longitude} != fact ${fv.longitude}`;
      if (cv.sign !== fv.sign) return `${alias} sign ${cv.sign} != fact ${fv.sign}`;
      if (Math.abs(cv.degreeInSign - fv.degreeInSign) > 0.01) return `${alias} degree ${cv.degreeInSign} != fact ${fv.degreeInSign}`;
      if ((cv.house ?? null) !== (fv.house ?? null)) return `${alias} house ${cv.house} != fact ${fv.house}`;
    }
    // POF full validation for every known-time report.
    const pof = commonField(v2, 'partOfFortune');
    const perr = isPartOfFortune(v2, pof);
    if (perr) return `partOfFortune: ${perr}`;
    return null;
  },
};

// ---- body positions in the flat facts map ----
const BODY_REQUIRED: FieldCheck[] = [
  'facts.natal.sun.position', 'facts.natal.moon.position', 'facts.natal.mercury.position', 'facts.natal.venus.position',
  'facts.natal.mars.position', 'facts.natal.jupiter.position', 'facts.natal.saturn.position', 'facts.natal.uranus.position',
  'facts.natal.neptune.position', 'facts.natal.pluto.position', 'facts.natal.northnode.position', 'facts.natal.southnode.position',
  'facts.natal.juno.position', 'facts.natal.ascendant.position', 'facts.natal.descendant.position', 'facts.natal.midheaven.position',
  'facts.natal.icumcoeli.position', 'facts.natal.partoffortune.position',
].map((id) => ({ path: id, check: (v2) => isPositionFact(factById(v2, id)) }));

// ---- A4 report-specific evidence bundles (R2-B4) ----
function relationshipEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'relationshipEvidence');
  if (!ev || typeof ev !== 'object') return 'relationshipEvidence absent';
  // F6-3: full RulerFact validation with cited cusp + ruler-position context
  { const e = isRulerFact(ev.seventhHouseRuler, 'common.cusp.7', `natal.${ev.seventhHouseRuler.ruler}.position`, v2); if (e) return `seventhHouseRuler: ${e}`; }
  if (!ev.seventhHouseOccupants || !Array.isArray(ev.seventhHouseOccupants.occupants)) return 'missing 7th-house occupants';
  // F5-1: named-pair validation for all four aspects
  for (const [k, pair] of [['venusMars','venus-mars'],['mercuryVenus','mercury-venus'],['moonVenus','moon-venus'],['venusSaturn','venus-saturn']] as const) {
    const e = validateNamedAspect(v2, ev.aspects?.[k], pair.split('-') as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  if (typeof ev.junoCondition !== 'string') return 'missing juno condition';
  if (!Array.isArray(ev.scoreDrivers) || ev.scoreDrivers.length === 0) return 'missing score drivers';
  // T3-6: Validate scoreDrivers don't contain dangling IDs
  const resolvable = new Set<string>(Object.keys(v2.facts));
  for (const driver of ev.scoreDrivers) {
    if (typeof driver === 'string' && driver && !resolvable.has(driver)) {
      return `dangling scoreDriver: ${driver}`;
    }
  }
  return null;
}
function loveBlueprintEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'loveBlueprintEvidence');
  if (!ev || typeof ev !== 'object') return 'loveBlueprintEvidence absent';
  // F6-3: full RulerFact validation for DSC ruler with context
  { const e = isRulerFact(ev.dscRuler, 'common.cusp.7', `natal.${ev.dscRuler.ruler}.position`, v2); if (e) return `dscRuler: ${e}`; }
  // F5-1: named-pair validation for all three aspects
  for (const [k, pair] of [['moonVenus','moon-venus'],['venusMars','venus-mars'],['junoSaturn','juno-saturn']] as const) {
    const e = validateNamedAspect(v2, ev.aspects?.[k], pair.split('-') as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  // F6-9: Chiron aspects must EQUAL the complete authoritative set (Chiron AND Venus/Moon).
  {
    const expected = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'venus' || av.bodyA === 'moon' || av.bodyB === 'venus' || av.bodyB === 'moon')));
    const e = requireExactAspectSet(ev.chironAspects, expected, 'chironAspects'); if (e) return e;
  }
  // F5-4: explicit Chiron present/absent state
  if (!ev.chironEvidence || typeof ev.chironEvidence !== 'object') return 'missing chironEvidence';
  if (typeof ev.chironEvidence.present !== 'boolean') return 'chironEvidence.present must be boolean';
  if (ev.chironEvidence.present) {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length === 0) return 'chironEvidence.present=true requires nonempty ids';
    // ids must equal chironAspects
    const ids = [...ev.chironEvidence.ids].sort();
    const aspects = [...(ev.chironAspects || [])].sort();
    if (JSON.stringify(ids) !== JSON.stringify(aspects)) return 'chironEvidence.ids must equal chironAspects';
    if (ev.chironEvidence.reason !== undefined) return 'chironEvidence.present=true must not have reason';
  } else {
    if (Array.isArray(ev.chironEvidence.ids) && ev.chironEvidence.ids.length > 0) return 'chironEvidence.present=false requires empty ids';
    if (ev.chironEvidence.reason !== 'No qualifying Chiron-to-Venus-or-Moon tie was found in this chart') return `chironEvidence.present=false reason must be exact, got ${ev.chironEvidence.reason}`;
  }
  if (typeof ev.northNodeSign !== 'string') return 'missing north node sign';
  return null;
}
function vocationEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'vocationEvidence');
  if (!ev || typeof ev !== 'object') return 'vocationEvidence absent';
  // F6-3: full RulerFact validation for all three rulers with context
  { const e = isRulerFact(ev.mcRuler, 'common.cusp.10', `natal.${ev.mcRuler.ruler}.position`, v2); if (e) return `mcRuler: ${e}`; }
  { const e = isRulerFact(ev.secondRuler, 'common.cusp.2', `natal.${ev.secondRuler.ruler}.position`, v2); if (e) return `secondRuler: ${e}`; }
  { const e = isRulerFact(ev.sixthRuler, 'common.cusp.6', `natal.${ev.sixthRuler.ruler}.position`, v2); if (e) return `sixthRuler: ${e}`; }
  // F5-1: named-pair validation for Saturn/Jupiter/Pluto to MC
  for (const [k, pair] of [['saturnAspect','saturn-midheaven'],['jupiterAspect','jupiter-midheaven'],['plutoAspect','pluto-midheaven']] as const) {
    const e = validateNamedAspect(v2, ev[k], pair.split('-') as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  // F6-6: wealth indicators must exactly equal the unique 2nd/6th/10th ruler positions.
  const expectedWealth = [...new Set([`natal.${ev.secondRuler.ruler}.position`, `natal.${ev.sixthRuler.ruler}.position`, `natal.${ev.mcRuler.ruler}.position`])].sort();
  const gotWealth = [...(ev.wealthIndicators || [])].sort();
  if (JSON.stringify(gotWealth) !== JSON.stringify(expectedWealth)) return `wealthIndicators ${gotWealth} != unique 2nd/6th/10th ${expectedWealth}`;
  // F5-9: complete MC package
  if (ev.mcPositionId !== 'natal.midheaven.position') return `mcPositionId must be natal.midheaven.position, got ${ev.mcPositionId}`;
  // F6-5: MC sign/degree must match the canonical MC position fact.
  const mc = factById(v2, 'natal.midheaven.position');
  if (!mc || mc.kind !== 'position') return 'natal.midheaven.position missing';
  const mcv: any = mc.value;
  if (ev.mcSign !== mcv.sign) return `mcSign ${ev.mcSign} != ${mcv.sign}`;
  if (Math.abs(ev.mcDegreeInSign - mcv.degreeInSign) > 0.01) return `mcDegreeInSign ${ev.mcDegreeInSign} != ${mcv.degreeInSign}`;
  // F6-5: mcAspects must equal the complete sorted authoritative set.
  const expectedMcAspects = commonField(v2, 'aspects')
    .filter((a: any) => a.value.bodyA === 'midheaven' || a.value.bodyB === 'midheaven')
    .map((a: any) => a.id).sort();
  const gotMcAspects = [...(ev.mcAspects || [])].sort();
  if (JSON.stringify(gotMcAspects) !== JSON.stringify(expectedMcAspects)) return `mcAspects count ${gotMcAspects.length} != authoritative ${expectedMcAspects.length}`;
  // F6-5: surfaced evidence-fact provenance must equal MC position + every MC aspect + required drivers.
  const surfaced = v2.facts['reportData.vocationEvidence'];
  if (!surfaced) return 'surfaced vocationEvidence fact missing';
  const expectedProv = ['common.ruler.10', 'common.ruler.2', 'common.ruler.6', 'score.vocation.archetype', ev.mcPositionId, ...expectedMcAspects].sort();
  const gotProv = [...(surfaced.provenance || [])].sort();
  if (JSON.stringify(gotProv) !== JSON.stringify(expectedProv)) return `surfaced provenance ${gotProv} != ${expectedProv}`;
  // T3-7: Vocation fails closed until exact 24-month career windows exist
  if (typeof ev.careerWindowsDeclared !== 'boolean') return 'missing careerWindowsDeclared';
  if (ev.careerWindowsDeclared !== true) return 'career windows not yet implemented';
  return null;
}
function karmicEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'karmicEvidence');
  if (!ev || typeof ev !== 'object') return 'karmicEvidence absent';
  // F6-3: full RulerFact validation for nodal rulers with context
  { const e = isRulerFact(ev.northNodeRuler, 'natal.northnode.position', `natal.${ev.northNodeRuler.ruler}.position`, v2); if (e) return `northNodeRuler: ${e}`; }
  { const e = isRulerFact(ev.southNodeRuler, 'natal.southnode.position', `natal.${ev.southNodeRuler.ruler}.position`, v2); if (e) return `southNodeRuler: ${e}`; }
  // F6-9: nodal aspects must EQUAL the complete authoritative set of aspects involving a node.
  {
    const expected = authoritativeAspectSet(v2, (av: any) => av.bodyA === 'northnode' || av.bodyA === 'southnode' || av.bodyB === 'northnode' || av.bodyB === 'southnode');
    const e = requireExactAspectSet(ev.nodalAspects, expected, 'nodalAspects'); if (e) return e;
  }
  // F6-9: nodal squares must EQUAL the complete authoritative set (node + square).
  {
    const expected = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'northnode' || av.bodyA === 'southnode' || av.bodyB === 'northnode' || av.bodyB === 'southnode') && av.aspectType === 'square'));
    const e = requireExactAspectSet(ev.nodalSquares, expected, 'nodalSquares'); if (e) return e;
  }
  // F5-1: named-pair validation for Saturn/Pluto evidence
  for (const [k, pair] of [['saturnEvidence','saturn-sun'],['plutoEvidence','pluto-sun']] as const) {
    const e = validateNamedAspect(v2, ev[k], pair.split('-') as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  // F6-9: Chiron aspects must EQUAL the complete authoritative set (Chiron AND a node).
  {
    const expected = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'northnode' || av.bodyA === 'southnode' || av.bodyB === 'northnode' || av.bodyB === 'southnode')));
    const e = requireExactAspectSet(ev.chironAspects, expected, 'chironAspects'); if (e) return e;
  }
  // F5-4: explicit Chiron present/absent state with consistency
  if (!ev.chironEvidence || typeof ev.chironEvidence !== 'object') return 'missing chironEvidence';
  if (typeof ev.chironEvidence.present !== 'boolean') return 'chironEvidence.present must be boolean';
  if (ev.chironEvidence.present) {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length === 0) return 'chironEvidence.present=true requires nonempty ids';
    const ids = [...ev.chironEvidence.ids].sort();
    const aspects = [...(ev.chironAspects || [])].sort();
    if (JSON.stringify(ids) !== JSON.stringify(aspects)) return 'chironEvidence.ids must equal chironAspects';
    if (ev.chironEvidence.reason !== undefined) return 'chironEvidence.present=true must not have reason';
  } else {
    if (Array.isArray(ev.chironEvidence.ids) && ev.chironEvidence.ids.length > 0) return 'chironEvidence.present=false requires empty ids';
    if (ev.chironEvidence.reason !== 'No qualifying Chiron-to-node tie was found in this chart') return `chironEvidence.present=false reason must be exact, got ${ev.chironEvidence.reason}`;
  }
  return null;
}

const REPORT_REQUIRED: Record<ReportType, FieldCheck[]> = {
  natal: [
    { path: 'reportData (natal has no A4 bundle)', check: () => null },
  ],
  relationship: [
    { path: 'reportData.relationshipScores', check: (v2) => (reportField(v2, 'relationshipScores') ? null : 'absent') },
    { path: 'reportData.relationshipScores.emotionalStyle', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.emotionalStyle')) },
    { path: 'reportData.relationshipScores.desire', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.desire')) },
    { path: 'reportData.relationshipScores.communication', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.communication')) },
    { path: 'reportData.relationshipScores.commitment', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.commitment')) },
    { path: 'reportData.relationshipScores.attachment', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.attachment')) },
    { path: 'reportData.relationshipEvidence', check: relationshipEvidenceCheck },
  ],
  loveblueprint: [
    { path: 'reportData.loveBlueprintArchetype', check: (v2) => (reportField(v2, 'loveBlueprintArchetype') ? null : 'absent') },
    { path: 'reportData.relationshipScores', check: (v2) => (reportField(v2, 'relationshipScores') ? null : 'absent') },
    { path: 'reportData.relationshipScores.emotionalStyle', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.emotionalStyle')) },
    { path: 'reportData.relationshipScores.desire', check: (v2) => isScoreBand(reportField(v2, 'relationshipScores.desire')) },
    { path: 'reportData.loveBlueprintEvidence', check: loveBlueprintEvidenceCheck },
  ],
  vocation: [
    { path: 'reportData.vocationArchetype', check: (v2) => (reportField(v2, 'vocationArchetype') ? null : 'absent') },
    { path: 'reportData.vocationEvidence', check: vocationEvidenceCheck },
  ],
  karmicshadow: [
    { path: 'reportData.karmic', check: (v2) => (reportField(v2, 'karmic') ? null : 'absent') },
    { path: 'reportData.karmic.axis', check: (v2) => (reportField(v2, 'karmic.axis') ? null : 'absent') },
    { path: 'reportData.karmic.drivers', check: (v2) => (Array.isArray(reportField(v2, 'karmic.drivers')) && reportField(v2, 'karmic.drivers').length ? null : 'empty drivers') },
    { path: 'reportData.karmicEvidence', check: karmicEvidenceCheck },
  ],
  // Timing reports require a full 12-month event ledger (built in P6/P7). Fail closed.
  lovetiming: [{ path: 'reportData.transitLedger', check: (v2) => (reportField(v2, 'transitLedger') ? null : 'absent') }],
  yearlytransit: [{ path: 'reportData.transitLedger', check: (v2) => (reportField(v2, 'transitLedger') ? null : 'absent') }],
  // Full Cosmic requires approved component versions (assembled in P8).
  fullcosmic: [{ path: 'reportData.componentManifest', check: (v2) => (reportField(v2, 'componentManifest') ? null : 'absent') }],
};

export function preflightReport(reportType: ReportType, v2: VerifiedFactsV2): PreflightResult {
  const all: FieldCheck[] = [
    ...COMMON_POSITION_FIELDS, ...COMMON_POINT_FIELDS, ...BODY_REQUIRED, COMMON_CONSISTENCY, ...(REPORT_REQUIRED[reportType] || []),
  ];
  const missing: string[] = [];
  for (const f of all) {
    const err = f.check(v2);
    if (err) missing.push(`${f.path} (${err})`);
  }
  if (missing.length > 0) return { status: 'input_incomplete', missing, mode: 'preflight_failed' };
  return { status: 'complete', missing: [], mode: 'preflight_ok' };
}

// Reject any derived fact whose provenance / driver id does not resolve to an
// existing fact in the ledger (B2 — no dangling ids).
export function validateFactResolution(v2: VerifiedFactsV2): { ok: boolean; dangling: string[] } {
  const resolvable = new Set<string>(Object.keys(v2.facts));
  // R2-B10 addendum: resolvable ids are exactly the fact ids in v2.facts.
  // build.ts surfaces every common.* fact (incl. topAspectByBody, cusps, rulers,
  // occupants, nodal rulers) as a real VerifiedFact, so no 'common.*' aliases are
  // manufactured here.

  const dangling: string[] = [];
  const check = (id: string, from: string) => { if (!resolvable.has(id)) dangling.push(`${id} (referenced by ${from})`); };
  const mark = (f: VerifiedFact) => { for (const p of f.provenance || []) if (!resolvable.has(p)) check(p, f.id); };
  for (const f of Object.values(v2.facts)) mark(f);
  for (const f of [v2.common.chartRuler, v2.common.partOfFortune, v2.common.moonPhase, v2.common.elements, v2.common.modalities]) {
    if (f) mark(f);
  }
  for (const r of [v2.common.rulers?.dsc, v2.common.rulers?.second, v2.common.rulers?.sixth, v2.common.rulers?.tenth]) {
    if (r) for (const p of r.provenance) check(p, `common.ruler.${r.house}`);
  }
  for (const nr of [v2.common.nodalRulers?.north, v2.common.nodalRulers?.south]) {
    if (nr) for (const p of nr.provenance) check(p, `nodalRuler.${nr.ruler}`);
  }
  // T3-6: Enhanced scan for drivers, aspectId, provenance, scoreDrivers
  const scanDrivers = (obj: any, path: string) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => scanDrivers(item, `${path}[${i}]`));
      return;
    }
    // Check drivers
    if (Array.isArray(obj.drivers)) {
      for (const d of obj.drivers) check(d, `${path}.drivers`);
    }
    // Check aspectId resolution
    if (obj.aspectId && typeof obj.aspectId === 'string') {
      check(obj.aspectId, `${path}.aspectId`);
    }
    // Check nested provenance
    if (Array.isArray(obj.provenance)) {
      obj.provenance.forEach((p: string, i: number) => {
        if (typeof p === 'string' && p) check(p, `${path}.provenance[${i}]`);
      });
    }
    // Check scoreDrivers
    if (Array.isArray(obj.scoreDrivers)) {
      obj.scoreDrivers.forEach((d: string, i: number) => {
        if (typeof d === 'string' && d) check(d, `${path}.scoreDrivers[${i}]`);
      });
    }
    // Recurse into object properties (but not the arrays we already scanned)
    for (const k of Object.keys(obj)) {
      if (k !== 'drivers' && k !== 'provenance' && k !== 'scoreDrivers' && k !== 'aspectId') {
        scanDrivers(obj[k], `${path}.${k}`);
      }
    }
  };
  scanDrivers(v2.reportData, 'reportData');
  // F4-6: also validate the explicit semantic evidence-ID arrays field-by-field.
  const v: any = v2.reportData;
  const idArrays: [string, string[] | undefined, string][] = [
    ['vocationEvidence.wealthIndicators', (v.vocationEvidence as any)?.wealthIndicators, 'position'],
    ['karmicEvidence.nodalAspects', (v.karmicEvidence as any)?.nodalAspects, 'aspect'],
    ['karmicEvidence.nodalSquares', (v.karmicEvidence as any)?.nodalSquares, 'aspect'],
    ['karmicEvidence.chironAspects', (v.karmicEvidence as any)?.chironAspects, 'aspect'],
    ['loveBlueprintEvidence.chironAspects', (v.loveBlueprintEvidence as any)?.chironAspects, 'aspect'],
  ];
  for (const [label, arr, kind] of idArrays) {
    if (!arr) continue;
    for (const id of arr) {
      if (typeof id !== 'string' || !id) { dangling.push(`${id} (${label})`); continue; }
      const fact = v2.facts[id];
      if (!fact) { dangling.push(`${id} (${label})`); continue; }
      if (fact.kind !== kind) { dangling.push(`${id} (${label}: kind ${fact.kind} != ${kind})`); continue; }
      // F5-3: semantic validation for report-specific arrays
      if (label === 'karmicEvidence.nodalAspects' || label === 'karmicEvidence.nodalSquares') {
        const av = fact.value as any;
        if (!av.bodyA.includes('node') && !av.bodyB.includes('node')) {
          dangling.push(`${id} (${label}: must involve a node)`);
        }
      }
      if (label === 'karmicEvidence.chironAspects') {
        const av = fact.value as any;
        if (av.bodyA !== 'chiron' && av.bodyB !== 'chiron') {
          dangling.push(`${id} (${label}: must involve chiron)`);
        }
      }
      if (label === 'loveBlueprintEvidence.chironAspects') {
        const av = fact.value as any;
        if (av.bodyA !== 'chiron' && av.bodyB !== 'chiron') {
          dangling.push(`${id} (${label}: must involve chiron)`);
        }
      }
    }
  }
  return { ok: dangling.length === 0, dangling };
}
