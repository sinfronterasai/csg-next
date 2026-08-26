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
import { ASPECT_ORBS, rulerKeyForSign } from './derived';
import { dignityFor, signFromLongitude, getPlanet, getSign, SIGNS } from '@/lib/astrology';

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
  // F8-9: compare endpoint TUPLES directly in either orientation. Never concatenate
  // endpoint keys for identity (keys may contain hyphens; concatenation is not injective).
  const fwd = av.bodyA === a && av.bodyB === b;
  const rev = av.bodyA === b && av.bodyB === a;
  if (!fwd && !rev) return `aspectId endpoints [${av.bodyA},${av.bodyB}] != expected [${a},${b}]`;
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

// F7-5: derive the complete authoritative aspect set from canonical v2.facts entries
// with kind === 'aspect' (immutable), NOT the mutable common.aspects index.
function canonicalAspectFacts(v2: VerifiedFactsV2): any[] {
  return Object.values(v2.facts).filter((f: any) => f && f.kind === 'aspect');
}
function authoritativeAspectSet(v2: VerifiedFactsV2, predicate: (av: any) => boolean): string[] {
  return canonicalAspectFacts(v2).filter((a: any) => predicate(a.value)).map((a: any) => a.id).sort();
}
function requireExactAspectSet(got: any, expected: string[], label: string): string | null {
  if (!Array.isArray(got)) return `${label}: not an array`;
  const g = [...got].sort();
  if (g.length !== expected.length) return `${label}: count ${g.length} != authoritative ${expected.length} (omission/extra/duplicate)`;
  if (JSON.stringify(g) !== JSON.stringify(expected)) return `${label}: set differs from authoritative complete set`;
  return null;
}
// F8-6: common.aspects must equal the complete canonical aspect-fact set from v2.facts
// by FULL content (ID, kind, source, display, full value, provenance), not IDs only.
// Reject duplicate IDs explicitly.
function requireCommonAspectsComplete(v2: VerifiedFactsV2): string | null {
  const canonical = canonicalAspectFacts(v2);
  const common: any[] = commonField(v2, 'aspects') || [];
  // Reject duplicate IDs in the common index.
  const seen = new Set<string>();
  for (const a of common) {
    if (!a || typeof a.id !== 'string') return 'common.aspects contains a non-aspect entry';
    if (seen.has(a.id)) return `common.aspects duplicate id: ${a.id}`;
    seen.add(a.id);
  }
  if (common.length !== canonical.length) {
    return `common.aspects count ${common.length} != canonical ${canonical.length}`;
  }
  // Build ID-keyed maps and compare full content (ignoring key order).
  const canonById = new Map(canonical.map((f: any) => [f.id, f]));
  const commonById = new Map(common.map((f: any) => [f.id, f]));
  for (const id of canonById.keys()) {
    if (!commonById.has(id)) return `common.aspects missing canonical aspect ${id}`;
    const c: any = canonById.get(id);
    const m: any = commonById.get(id);
    if (c.kind !== m.kind) return `aspect ${id} kind ${m.kind} != ${c.kind}`;
    if (c.source !== m.source) return `aspect ${id} source ${m.source} != ${c.source}`;
    if (c.display !== m.display) return `aspect ${id} display ${m.display} != ${c.display}`;
    if (JSON.stringify([...(m.provenance || [])].sort()) !== JSON.stringify([...(c.provenance || [])].sort())) {
      return `aspect ${id} provenance mismatch`;
    }
    if (JSON.stringify(m.value) !== JSON.stringify(c.value)) return `aspect ${id} value mismatch`;
  }
  return null;
}

// F8-8: validate a single cusp fact by full content. The critical check is that the
// declared sign/signLabel agree with the canonical sign derived from cuspLongitude, so a
// tampered cusp (sign changed, longitude kept) is caught BEFORE the ruler is derived.
function validateCuspFact(v2: VerifiedFactsV2, cuspId: string): string | null {
  const f: any = factById(v2, cuspId);
  if (!f) return `cusp ${cuspId} missing`;
  if (f.kind !== 'point') return `cusp ${cuspId} kind ${f.kind} != point`;
  const num = Number(cuspId.replace('common.cusp.', ''));
  if (!Number.isInteger(num) || num < 1 || num > 12) return `cusp id ${cuspId} does not encode a house number`;
  const v: any = f.value;
  if (typeof v.num !== 'number' || v.num !== num) return `cusp ${cuspId} num ${v.num} != ${num}`;
  if (typeof v.cuspLongitude !== 'number' || v.cuspLongitude < 0 || v.cuspLongitude >= 360) return `cusp ${cuspId} cuspLongitude ${v.cuspLongitude} out of range`;
  const expectedSign = signFromLongitude(v.cuspLongitude);
  if (v.sign !== expectedSign.sign.key) return `cusp ${cuspId} sign ${v.sign} != derived ${expectedSign.sign.key} from cuspLongitude ${v.cuspLongitude}`;
  if (v.signLabel !== expectedSign.sign.label) return `cusp ${cuspId} signLabel ${v.signLabel} != ${expectedSign.sign.label}`;
  if (typeof f.source !== 'string' || !f.source) return `cusp ${cuspId} source missing`;
  if (!Array.isArray(f.provenance)) return `cusp ${cuspId} provenance not an array`;
  return null;
}
// F8-8: common.houses must equal the complete flat cusp-fact set by full content.
function requireHousesEqualCusps(v2: VerifiedFactsV2): string | null {
  const houses: any = commonField(v2, 'houses');
  if (!Array.isArray(houses)) return 'common.houses missing or not an array';
  const cusps = (commonField(v2, 'aspects') && []) as any[]; // placeholder (unused)
  const flatCusps = Object.keys(v2.facts)
    .filter((id) => id.startsWith('common.cusp.'))
    .sort();
  const houseIds = [...houses].map((h: any) => `common.cusp.${h.num ?? h.house}`).sort();
  if (JSON.stringify(houseIds) !== JSON.stringify(flatCusps)) {
    return `common.houses (${houseIds.length}) != flat cusp facts (${flatCusps.length})`;
  }
  // Full-content equality for each house vs its cusp fact.
  for (const h of houses) {
    const id = `common.cusp.${h.num ?? h.house}`;
    const f: any = factById(v2, id);
    if (!f) return `house ${id} has no matching cusp fact`;
    const fv: any = f.value;
    if (JSON.stringify(fv) !== JSON.stringify(h)) return `house ${id} content != cusp fact content`;
  }
  return null;
}
// F8-10: expected contextual house for a ruler, derived from its context fact id.
// House rulers map to their house number; nodal rulers use a locked sentinel.
function expectedRulerHouse(contextId: string): number | string {
  if (contextId === 'common.cusp.7') return 7;
  if (contextId === 'common.cusp.2') return 2;
  if (contextId === 'common.cusp.6') return 6;
  if (contextId === 'common.cusp.10') return 10;
  if (contextId === 'natal.northnode.position' || contextId === 'natal.southnode.position') return 'nodal';
  return -1;
}

// F7-3: Ruler validator is given ONLY the canonical context (cusp or node fact id),
// never a position id built from a self-declared ruler. It resolves the context sign,
// derives the expected ruler from the authoritative sign table (rulerKeyForSign), then
// obtains natal.<derivedRuler>.position internally and compares every field + provenance.
function isRulerFact(v: any, contextId: string, v2: VerifiedFactsV2): string | null {
  if (!v || typeof v !== 'object') return 'absent';
  if (typeof v.ruler !== 'string' || !v.ruler) return 'missing ruler key';
  if (typeof v.sign !== 'string' || !v.sign) return 'missing sign';
  if (typeof v.degreeInSign !== 'number' || v.degreeInSign < 0 || v.degreeInSign >= 30) return 'degreeInSign out of range';
  if (v.house_of_ruler !== null && (typeof v.house_of_ruler !== 'number' || v.house_of_ruler < 1 || v.house_of_ruler > 12)) return 'ruler house out of range';
  if (typeof v.retrograde !== 'boolean') return 'retrograde must be boolean';
  if (!['domicile','exaltation','detriment','fall',null].includes(v.dignity)) return 'invalid dignity';
  if (typeof v.condition !== 'string' || !v.condition) return 'missing condition';
  if (typeof v.rulerLabel !== 'string' || !v.rulerLabel) return 'missing rulerLabel';
  // F8-8: validate the context cusp fact by full content BEFORE deriving the ruler.
  // Only cusp facts (common.cusp.N) are cusp-shaped; node contexts are planet positions.
  if (contextId.startsWith('common.cusp.')) {
    const cuspErr = validateCuspFact(v2, contextId);
    if (cuspErr) return `context ${contextId}: ${cuspErr}`;
  }
  // Resolve the context sign from the (validated) cusp/node fact.
  const ctx: any = factById(v2, contextId);
  // Cusp facts are kind 'point'; node facts are kind 'position'. Unwrap to the value.
  const ctxVal: any = (ctx.kind === 'position' || ctx.kind === 'point') ? ctx.value : ctx;
  const ctxSign = ctxVal.sign;
  if (typeof ctxSign !== 'string' || !ctxSign) return `context ${contextId} missing sign`;
  const expectedRuler = rulerKeyForSign(ctxSign);
  if (!expectedRuler) return `no ruler for context sign ${ctxSign}`;
  // Ruler key/label must match the derived ruler.
  if (v.ruler !== expectedRuler) return `ruler ${v.ruler} != derived ${expectedRuler} from ${contextId} sign ${ctxSign}`;
  const expectedLabel = getPlanet(expectedRuler)?.label ?? expectedRuler;
  if (v.rulerLabel !== expectedLabel) return `rulerLabel ${v.rulerLabel} != ${expectedLabel}`;
  // F8-10: validate the contextual house field independently of house_of_ruler.
  const expHouse = expectedRulerHouse(contextId);
  if (expHouse === -1) return `unknown ruler context ${contextId}`;
  if (expHouse === 'nodal') {
    if (v.house !== 'nodal') return `ruler house ${v.house} != nodal sentinel for ${contextId}`;
  } else {
    if (typeof v.house !== 'number' || v.house !== expHouse) return `ruler house ${v.house} != expected ${expHouse} for ${contextId}`;
  }
  // Resolve the ruler planet position internally (canonical fact).
  const rulerPositionId = `natal.${expectedRuler}.position`;
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
  // Provenance must equal exactly [contextId, derivedRulerPositionId].
  const expProv = [contextId, rulerPositionId].sort();
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

// F7-4: canonical normalized position-value equality. Compares the alias (common.*)
// against the canonical fact value across every contract field, including key, label,
// sign/signLabel, longitude, degree, house, retrograde, dignity, uncertainty metadata.
// POF sect/formula/value identity is checked for the Part-of-Fortune alias.
function positionsEqual(alias: any, factValue: any, isPof: boolean): string | null {
  if (!alias || typeof alias !== 'object') return 'alias absent';
  if (!factValue || typeof factValue !== 'object') return 'fact value absent';
  const checks: [string, boolean, any, any][] = [
    ['key', alias.key === factValue.key, alias.key, factValue.key],
    ['label', alias.label === factValue.label, alias.label, factValue.label],
    ['sign', alias.sign === factValue.sign, alias.sign, factValue.sign],
    ['signLabel', alias.signLabel === factValue.signLabel, alias.signLabel, factValue.signLabel],
    ['longitude', Math.abs((alias.longitude ?? 0) - (factValue.longitude ?? 0)) <= 0.001, alias.longitude, factValue.longitude],
    ['degreeInSign', Math.abs((alias.degreeInSign ?? 0) - (factValue.degreeInSign ?? 0)) <= 0.01, alias.degreeInSign, factValue.degreeInSign],
    ['house', (alias.house ?? null) === (factValue.house ?? null), alias.house, factValue.house],
    ['retrograde', alias.retrograde === factValue.retrograde, alias.retrograde, factValue.retrograde],
    ['dignity', alias.dignity === factValue.dignity, alias.dignity, factValue.dignity],
    // F8-7: use the ACTUAL contract field `uncertain` (production writes v.uncertain = true),
    // not a phantom `uncertainty` field. Reject contradictory or unexpected metadata.
    ['uncertain', (alias.uncertain ?? null) === (factValue.uncertain ?? null), alias.uncertain, factValue.uncertain],
  ];
  for (const [name, ok, a, b] of checks) {
    if (!ok) return `${name}: alias ${JSON.stringify(a)} != fact ${JSON.stringify(b)}`;
  }
  // F8-7: reject unexpected metadata keys (contract only allows the checked fields).
  const allowed = new Set(['key','label','sign','signLabel','longitude','degreeInSign','house','retrograde','dignity','uncertain','display','sect','formula']);
  for (const k of Object.keys(alias)) {
    if (!allowed.has(k)) return `alias unexpected metadata key: ${k}`;
  }
  if (isPof) {
    if (alias.sect !== factValue.sect) return `POF sect ${alias.sect} != ${factValue.sect}`;
    if (alias.formula !== factValue.formula) return `POF formula ${alias.formula} != ${factValue.formula}`;
  }
  return null;
}
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
      const isPof = alias === 'partOfFortune';
      const eqErr = positionsEqual(cv, fv, isPof);
      if (eqErr) return `${alias}: ${eqErr}`;
    }
    // F8-2: fully validate BOTH POF wrappers after serialization.
    const pof = commonField(v2, 'partOfFortune');
    const perr = isPartOfFortune(v2, pof);
    if (perr) return `partOfFortune: ${perr}`;
    // Flat fact wrapper semantics: source must be derived-deterministic, provenance exact
    // ASC/Moon/Sun, and its value must equal the canonical alias value (wrapper vs alias).
    const flatPof = factById(v2, 'natal.partoffortune.position');
    if (!flatPof) return 'flat partoffortune fact missing';
    if (flatPof.source !== 'derived-deterministic') return `flat POF source ${flatPof.source} != derived-deterministic`;
    const expFlatProv = ['natal.ascendant.position', 'natal.moon.position', 'natal.sun.position'].sort();
    const gotFlatProv = [...(flatPof.provenance || [])].sort();
    if (JSON.stringify(gotFlatProv) !== JSON.stringify(expFlatProv)) return `flat POF provenance ${gotFlatProv} != ASC/Moon/Sun`;
    const flatVal: any = flatPof.value;
    const aliasVal: any = (pof.kind === 'position' ? pof.value : pof);
    const pofEq = positionsEqual(flatVal, aliasVal, true);
    if (pofEq) return `flat POF value != alias value: ${pofEq}`;
    // F7-5: common.aspects must equal the complete canonical aspect-fact set.
    const commonChk = requireCommonAspectsComplete(v2); if (commonChk) return commonChk;
    // F8-8: common.houses must equal the complete flat cusp-fact set by full content.
    const housesChk = requireHousesEqualCusps(v2); if (housesChk) return housesChk;
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
  { const e = isRulerFact(ev.seventhHouseRuler, 'common.cusp.7', v2); if (e) return `seventhHouseRuler: ${e}`; }
  if (!ev.seventhHouseOccupants || !Array.isArray(ev.seventhHouseOccupants.occupants)) return 'missing 7th-house occupants';
  // F7-2: literal structured endpoint tuples (no pair.split('-') identity path).
  for (const [k, endpoints] of [['venusMars',['venus','mars']],['mercuryVenus',['mercury','venus']],['moonVenus',['moon','venus']],['venusSaturn',['venus','saturn']]] as const) {
    const e = validateNamedAspect(v2, ev.aspects?.[k], endpoints as unknown as [string, string]); if (e) return `aspect ${k}: ${e}`;
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
  { const e = isRulerFact(ev.dscRuler, 'common.cusp.7', v2); if (e) return `dscRuler: ${e}`; }
  // F7-2: literal structured endpoint tuples (no pair.split('-') identity path).
  for (const [k, endpoints] of [['moonVenus',['moon','venus']],['venusMars',['venus','mars']],['junoSaturn',['juno','saturn']]] as const) {
    const e = validateNamedAspect(v2, ev.aspects?.[k], endpoints as unknown as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  // F6-9: Chiron aspects must EQUAL the complete authoritative set (Chiron AND Venus/Moon).
  {
    const expected = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'venus' || av.bodyA === 'moon' || av.bodyB === 'venus' || av.bodyB === 'moon')));
    const e = requireExactAspectSet(ev.chironAspects, expected, 'chironAspects'); if (e) return e;
  }
  // F8-3: Chiron state derives from the authoritative set. present === (set.length > 0).
  const chironAuth = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'venus' || av.bodyA === 'moon' || av.bodyB === 'venus' || av.bodyB === 'moon')));
  if (!ev.chironEvidence || typeof ev.chironEvidence !== 'object') return 'missing chironEvidence';
  if (typeof ev.chironEvidence.present !== 'boolean') return 'chironEvidence.present must be boolean';
  if (ev.chironEvidence.present !== (chironAuth.length > 0)) {
    return `chironEvidence.present ${ev.chironEvidence.present} != (authoritative set length ${chironAuth.length} > 0)`;
  }
  if (ev.chironEvidence.present) {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length === 0) return 'chironEvidence.present=true requires nonempty ids';
    // ids must equal chironAspects
    const ids = [...ev.chironEvidence.ids].sort();
    const aspects = [...(ev.chironAspects || [])].sort();
    if (JSON.stringify(ids) !== JSON.stringify(aspects)) return 'chironEvidence.ids must equal chironAspects';
    if (ev.chironEvidence.reason !== undefined) return 'chironEvidence.present=true must not have reason';
  } else {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length !== 0) return 'chironEvidence.present=false requires explicit empty ids: []';
    if (chironAuth.length !== 0) return 'chironEvidence.present=false but authoritative set is nonempty';
    if (ev.chironEvidence.reason !== 'No qualifying Chiron-to-Venus-or-Moon tie was found in this chart') return `chironEvidence.present=false reason must be exact, got ${ev.chironEvidence.reason}`;
  }
  if (typeof ev.northNodeSign !== 'string') return 'missing north node sign';
  return null;
}
function vocationEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'vocationEvidence');
  if (!ev || typeof ev !== 'object') return 'vocationEvidence absent';
  // F8-5: ACCUMULATE all Vocation semantic errors; the career-window blocker is appended
  // independently and must NOT suppress (nor be suppressed by) any semantic error.
  const semanticErrors: string[] = [];
  // F6-3: full RulerFact validation for all three rulers with context
  { const e = isRulerFact(ev.mcRuler, 'common.cusp.10', v2); if (e) semanticErrors.push(`mcRuler: ${e}`); }
  { const e = isRulerFact(ev.secondRuler, 'common.cusp.2', v2); if (e) semanticErrors.push(`secondRuler: ${e}`); }
  { const e = isRulerFact(ev.sixthRuler, 'common.cusp.6', v2); if (e) semanticErrors.push(`sixthRuler: ${e}`); }
  // F7-2: literal structured endpoint tuples (no pair.split('-') identity path).
  for (const [k, endpoints] of [['saturnAspect',['saturn','midheaven']],['jupiterAspect',['jupiter','midheaven']],['plutoAspect',['pluto','midheaven']]] as const) {
    const e = validateNamedAspect(v2, ev[k], endpoints as unknown as [string, string]); if (e) semanticErrors.push(`aspect ${k}: ${e}`);
  }
  // F6-6: wealth indicators must exactly equal the unique 2nd/6th/10th ruler positions.
  const expectedWealth = [...new Set([`natal.${ev.secondRuler.ruler}.position`, `natal.${ev.sixthRuler.ruler}.position`, `natal.${ev.mcRuler.ruler}.position`])].sort();
  const gotWealth = [...(ev.wealthIndicators || [])].sort();
  if (JSON.stringify(gotWealth) !== JSON.stringify(expectedWealth)) semanticErrors.push(`wealthIndicators ${gotWealth} != unique 2nd/6th/10th ${expectedWealth}`);
  // F5-9: complete MC package
  if (ev.mcPositionId !== 'natal.midheaven.position') semanticErrors.push(`mcPositionId must be natal.midheaven.position, got ${ev.mcPositionId}`);
  // F6-5: MC sign/degree must match the canonical MC position fact.
  const mc = factById(v2, 'natal.midheaven.position');
  if (!mc || mc.kind !== 'position') semanticErrors.push('natal.midheaven.position missing');
  else {
    const mcv: any = mc.value;
    if (ev.mcSign !== mcv.sign) semanticErrors.push(`mcSign ${ev.mcSign} != ${mcv.sign}`);
    if (Math.abs(ev.mcDegreeInSign - mcv.degreeInSign) > 0.01) semanticErrors.push(`mcDegreeInSign ${ev.mcDegreeInSign} != ${mcv.degreeInSign}`);
  }
  // F7-5: mcAspects must equal the complete authoritative set derived from canonical facts.
  const expectedMcAspects = authoritativeAspectSet(v2, (av: any) => av.bodyA === 'midheaven' || av.bodyB === 'midheaven');
  const gotMcAspects = [...(ev.mcAspects || [])].sort();
  if (JSON.stringify(gotMcAspects) !== JSON.stringify(expectedMcAspects)) semanticErrors.push(`mcAspects count ${gotMcAspects.length} != authoritative ${expectedMcAspects.length}`);
  // F7-5: common.aspects must equal the complete canonical aspect-fact set.
  const commonChk = requireCommonAspectsComplete(v2); if (commonChk) semanticErrors.push(commonChk);
  // F6-5: surfaced evidence-fact provenance must equal MC position + every MC aspect + required drivers.
  const surfaced = v2.facts['reportData.vocationEvidence'];
  if (!surfaced) semanticErrors.push('surfaced vocationEvidence fact missing');
  else {
    const expectedProv = ['common.ruler.10', 'common.ruler.2', 'common.ruler.6', 'score.vocation.archetype', ev.mcPositionId, ...expectedMcAspects].sort();
    const gotProv = [...(surfaced.provenance || [])].sort();
    if (JSON.stringify(gotProv) !== JSON.stringify(expectedProv)) semanticErrors.push(`surfaced provenance ${gotProv} != ${expectedProv}`);
  }
  // T3-7: Vocation fails closed until exact 24-month career windows exist. This is appended
  // independently of the semantic errors collected above (neither suppresses the other).
  const careerBlocker = (typeof ev.careerWindowsDeclared !== 'boolean') ? 'missing careerWindowsDeclared'
    : (ev.careerWindowsDeclared !== true ? 'career windows not yet implemented' : null);
  if (careerBlocker) semanticErrors.push(careerBlocker);
  if (semanticErrors.length > 0) return semanticErrors.join(' | ');
  return null;
}
function karmicEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'karmicEvidence');
  if (!ev || typeof ev !== 'object') return 'karmicEvidence absent';
  // F6-3: full RulerFact validation for nodal rulers with context
  { const e = isRulerFact(ev.northNodeRuler, 'natal.northnode.position', v2); if (e) return `northNodeRuler: ${e}`; }
  { const e = isRulerFact(ev.southNodeRuler, 'natal.southnode.position', v2); if (e) return `southNodeRuler: ${e}`; }
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
  // F7-2: literal structured endpoint tuples (no pair.split('-') identity path).
  for (const [k, endpoints] of [['saturnEvidence',['saturn','sun']],['plutoEvidence',['pluto','sun']]] as const) {
    const e = validateNamedAspect(v2, ev[k], endpoints as unknown as [string, string]); if (e) return `aspect ${k}: ${e}`;
  }
  // F6-9: Chiron aspects must EQUAL the complete authoritative set (Chiron AND a node).
  {
    const expected = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'northnode' || av.bodyA === 'southnode' || av.bodyB === 'northnode' || av.bodyB === 'southnode')));
    const e = requireExactAspectSet(ev.chironAspects, expected, 'chironAspects'); if (e) return e;
  }
  // F8-3: Chiron state derives from the authoritative set. present === (set.length > 0).
  const chironAuth = authoritativeAspectSet(v2, (av: any) => ((av.bodyA === 'chiron' || av.bodyB === 'chiron') && (av.bodyA === 'northnode' || av.bodyA === 'southnode' || av.bodyB === 'northnode' || av.bodyB === 'southnode')));
  if (!ev.chironEvidence || typeof ev.chironEvidence !== 'object') return 'missing chironEvidence';
  if (typeof ev.chironEvidence.present !== 'boolean') return 'chironEvidence.present must be boolean';
  if (ev.chironEvidence.present !== (chironAuth.length > 0)) {
    return `chironEvidence.present ${ev.chironEvidence.present} != (authoritative set length ${chironAuth.length} > 0)`;
  }
  if (ev.chironEvidence.present) {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length === 0) return 'chironEvidence.present=true requires nonempty ids';
    const ids = [...ev.chironEvidence.ids].sort();
    const aspects = [...(ev.chironAspects || [])].sort();
    if (JSON.stringify(ids) !== JSON.stringify(aspects)) return 'chironEvidence.ids must equal chironAspects';
    if (ev.chironEvidence.reason !== undefined) return 'chironEvidence.present=true must not have reason';
  } else {
    if (!Array.isArray(ev.chironEvidence.ids) || ev.chironEvidence.ids.length !== 0) return 'chironEvidence.present=false requires explicit empty ids: []';
    if (chironAuth.length !== 0) return 'chironEvidence.present=false but authoritative set is nonempty';
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
