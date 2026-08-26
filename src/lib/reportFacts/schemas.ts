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
  if (typeof v.degreeInSign !== 'number' || v.degreeInSign < 0 || v.degreeInSign >= 30) return 'degreeInSign out of range';
  if (typeof v.sign !== 'string' || !v.sign) return 'missing sign';
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


// F4-5: validate that a non-null aspectId resolves to a real aspect fact whose
// endpoints and type match the evidence object.
function validateAspectId(v2: VerifiedFactsV2, ev: any, expectedPair: string): string | null {
  if (ev.aspectId === null || ev.aspectId === undefined) return null; // absence allowed
  const fact = factById(v2, ev.aspectId);
  if (!fact || fact.kind !== 'aspect') return `aspectId ${ev.aspectId} does not resolve to an aspect fact`;
  const av: any = fact.value;
  const pair = `${av.bodyA}-${av.bodyB}`;
  const rev = `${av.bodyB}-${av.bodyA}`;
  if (pair !== expectedPair && rev !== expectedPair) return `aspectId endpoints ${pair} != expected ${expectedPair}`;
  if (av.aspectType !== ev.aspectType) return `aspectId type ${av.aspectType} != evidence ${ev.aspectType}`;
  return null;
}

// F4-5: validate exact named pair for a relationship aspect field.
function validateNamedAspect(v2: VerifiedFactsV2, ev: any, expectedPair: string): string | null {
  const base = isAspectEvidence(ev);
  if (base) return base;
  if (ev.pair !== expectedPair) return `pair ${ev.pair} != expected ${expectedPair}`;
  const aid = validateAspectId(v2, ev, expectedPair);
  if (aid) return aid;
  return null;
}

// F4-6: validate a semantic evidence-ID array: every member must resolve to a real
// fact of the expected kind with matching endpoints/type (for aspects).
function validateIdArray(
  v2: VerifiedFactsV2, arr: any, kind: string, expectType?: string, expectBodies?: string[],
): string | null {
  if (!Array.isArray(arr)) return 'not an array';
  const resolvableKind = kind === 'aspect' ? 'aspect' : 'position';
  for (const id of arr) {
    if (typeof id !== 'string' || !id) return `invalid id entry: ${id}`;
    const fact = factById(v2, id);
    if (!fact) return `dangling id: ${id}`;
    if (fact.kind !== resolvableKind) return `id ${id} is ${fact.kind}, expected ${resolvableKind}`;
    if (kind === 'aspect') {
      const av: any = fact.value;
      if (expectType && av.aspectType !== expectType) return `id ${id} type ${av.aspectType} != ${expectType}`;
      if (expectBodies && !(expectBodies.includes(av.bodyA) && expectBodies.includes(av.bodyB))) {
        return `id ${id} bodies ${av.bodyA}/${av.bodyB} not in ${expectBodies?.join(',')}`;
      }
    }
  }
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
  'common.chartRuler', 'common.partOfFortune', 'common.moonPhase', 'common.elements', 'common.modalities',
].map((p) => ({ path: p, check: (v2) => (commonField(v2, p.replace('common.', '')) ? null : 'absent') }));

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
  if (!ev.seventhHouseRuler || typeof ev.seventhHouseRuler.ruler !== 'string') return 'missing 7th-house ruler';
  if (!ev.seventhHouseOccupants || !Array.isArray(ev.seventhHouseOccupants.occupants)) return 'missing 7th-house occupants';
  for (const [k, pair] of [['venusMars','venus-mars'],['mercuryVenus','mercury-venus'],['moonVenus','moon-venus'],['venusSaturn','venus-saturn']] as const) {
    const e = validateNamedAspect(v2, ev.aspects?.[k], pair as string); if (e) return `aspect ${k}: ${e}`;
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
  if (!ev.dscRuler || typeof ev.dscRuler.ruler !== 'string') return 'missing DSC ruler';
  for (const k of ['moonVenus', 'venusMars', 'junoSaturn'] as const) {
    const e = isAspectEvidence(ev.aspects?.[k]); if (e) return `aspect ${k}: ${e}`;
  }
  { const e = validateIdArray(v2, ev.chironAspects, 'aspect'); if (e) return `chironAspects: ${e}`; }
  if (typeof ev.northNodeSign !== 'string') return 'missing north node sign';
  return null;
}
function vocationEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'vocationEvidence');
  if (!ev || typeof ev !== 'object') return 'vocationEvidence absent';
  for (const k of ['mcRuler', 'secondRuler', 'sixthRuler'] as const) {
    if (!ev[k] || typeof ev[k].ruler !== 'string') return `missing ${k}`;
  }
  for (const k of ['saturnAspect', 'jupiterAspect', 'plutoAspect'] as const) {
    const e = isAspectEvidence(ev[k]); if (e) return `aspect ${k}: ${e}`;
  }
  { const e = validateIdArray(v2, ev.wealthIndicators, 'position'); if (e) return `wealthIndicators: ${e}`; }
  // T3-7: Vocation fails closed until exact 24-month career windows exist
  if (typeof ev.careerWindowsDeclared !== 'boolean') return 'missing careerWindowsDeclared';
  if (ev.careerWindowsDeclared !== true) return 'career windows not yet implemented';
  return null;
}
function karmicEvidenceCheck(v2: VerifiedFactsV2): string | null {
  const ev = reportField(v2, 'karmicEvidence');
  if (!ev || typeof ev !== 'object') return 'karmicEvidence absent';
  if (!ev.northNodeRuler || !ev.southNodeRuler) return 'missing nodal rulers';
  { const e = validateIdArray(v2, ev.nodalAspects, 'aspect'); if (e) return `nodalAspects: ${e}`; }
  { const e = validateIdArray(v2, ev.nodalSquares, 'aspect', 'square'); if (e) return `nodalSquares: ${e}`; }
  for (const k of ['saturnEvidence', 'plutoEvidence'] as const) {
    const e = validateNamedAspect(v2, ev[k], k === 'saturnEvidence' ? 'saturn-sun' : 'pluto-sun'); if (e) return `aspect ${k}: ${e}`;
  }
  { const e = validateIdArray(v2, ev.chironAspects, 'aspect'); if (e) return `chironAspects: ${e}`; }
  if (!ev.chironEvidence || typeof ev.chironEvidence.present !== 'boolean') return 'missing chironEvidence';
  return null;
}

const REPORT_REQUIRED: Record<ReportType, FieldCheck[]> = {
  natal: [],
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
    ...COMMON_POSITION_FIELDS, ...COMMON_POINT_FIELDS, ...BODY_REQUIRED, ...(REPORT_REQUIRED[reportType] || []),
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
      if (fact.kind !== kind) { dangling.push(`${id} (${label}: kind ${fact.kind} != ${kind})`); }
    }
  }
  return { ok: dangling.length === 0, dangling };
}
