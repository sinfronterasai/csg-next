// Per-report required-field contracts + deterministic preflight validator + fact
// resolution validator.
//
// A non-empty object is NOT sufficient (B2/B3). Each report type declares the
// exact fact ids it requires. `preflightReport` returns `input_incomplete` with a
// machine-readable list of missing ids (never rendered to the customer). On
// incomplete, the caller must NOT dispatch and must leave the purchase retryable.
//
// `validateFactResolution` rejects any derived fact whose provenance / driver id
// does not resolve to an existing fact in the ledger (B2 — no dangling ids).

import type { ReportType, VerifiedFactsV2, PreflightResult, VerifiedFact } from './types';

// Stable fact ids every KNOWN-TIME natal-based report must have before generation.
const COMMON_REQUIRED = [
  'common.ascendant',
  'common.descendant',
  'common.midheaven',
  'common.icumcoeli',
  'common.chartRuler',
  'common.northNode',
  'common.southNode',
  'common.juno',
  'common.partOfFortune',
  'common.moonPhase',
  'common.elements',
  'common.modalities',
  'common.aspects',
  'common.topAspectByBody',
  'common.patterns',
];

// Body-level positions required in `facts` (keyed by their stable fact id).
const BODY_REQUIRED = [
  'facts.natal.sun.position',
  'facts.natal.moon.position',
  'facts.natal.mercury.position',
  'facts.natal.venus.position',
  'facts.natal.mars.position',
  'facts.natal.jupiter.position',
  'facts.natal.saturn.position',
  'facts.natal.uranus.position',
  'facts.natal.neptune.position',
  'facts.natal.pluto.position',
  'facts.natal.northnode.position',
  'facts.natal.southnode.position',
  'facts.natal.juno.position',
  'facts.natal.ascendant.position',
  'facts.natal.descendant.position',
  'facts.natal.midheaven.position',
  'facts.natal.icumcoeli.position',
  'facts.natal.partoffortune.position',
];

// Report-specific required field groups (beyond common + body), encoding the
// locked A4 per-report payloads. Fields built in later phases remain DECLARED and
// fail closed here (B3) until their builder supplies them.
const REPORT_REQUIRED: Record<ReportType, string[]> = {
  natal: [],
  relationship: [
    'reportData.relationshipScores',
    'reportData.relationshipScores.emotionalConnection',
    'reportData.relationshipScores.passion',
    'reportData.relationshipScores.communication',
    'reportData.relationshipScores.stability',
    'reportData.relationshipScores.growth',
  ],
  loveblueprint: [
    'reportData.loveBlueprintArchetype',
    'reportData.relationshipScores',
    'reportData.relationshipScores.emotionalConnection',
    'reportData.relationshipScores.passion',
  ],
  vocation: [
    'reportData.vocationArchetype',
  ],
  karmicshadow: [
    'reportData.karmic',
    'reportData.karmic.axis',
    'reportData.karmic.drivers',
  ],
  // Timing reports require a full 12-month event ledger (built in P6/P7). Until
  // then preflight fails closed so no truncated timing report is dispatched.
  lovetiming: ['reportData.transitLedger'],
  yearlytransit: ['reportData.transitLedger'],
  // Full Cosmic requires approved component versions (assembled in P8).
  fullcosmic: ['reportData.componentManifest'],
};

// Solar-fallback (unknown-time) report group: only sign-level facts are
// authoritative. Angles/ruler/POF/aspects/Moon-degree are intentionally absent.
const SOLAR_FALLBACK_REQUIRED = [
  'common.solarSign',
  'common.solarSign.sun',
  'common.solarSign.moon',
  'common.northNode',
  'common.southNode',
  'common.juno',
  'facts.natal.sun.position',
  'facts.natal.northnode.position',
  'facts.natal.southnode.position',
  'facts.natal.juno.position',
];

function descend(obj: any, parts: string[]): boolean {
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return false;
    if (!(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

// Supports both flat keys (facts map keyed by full fact id, e.g.
// 'natal.sun.position') and nested object paths (e.g.
// 'reportData.relationshipScores.emotionalConnection'). A path matches if either
// the flat full key or the nested traversal resolves.
function hasPath(v2: VerifiedFactsV2, path: string): boolean {
  const parts = path.split('.');
  const head = parts[0];
  const root = head === 'common' ? v2.common : head === 'facts' ? v2.facts : head === 'reportData' ? v2.reportData : null;
  if (root == null) return false;
  const rest = parts.slice(1);
  const flatKey = rest.join('.');
  if (flatKey in (root as any)) return true;
  return descend(root, rest);
}

export function preflightReport(reportType: ReportType, v2: VerifiedFactsV2): PreflightResult {
  // At P0 every supported report type requires the full common+body set, so an
  // unknown-time (solar-fallback) chart fails closed for time-dependent reports
  // (B9: no fabricated angles/ruler/POF). The SOLAR_FALLBACK_REQUIRED group is
  // declared for future solar-only report types and is not auto-applied here.
  const required = [...COMMON_REQUIRED, ...BODY_REQUIRED, ...(REPORT_REQUIRED[reportType] || [])];
  const missing = required.filter((id) => !hasPath(v2, id));
  if (missing.length > 0) {
    return { status: 'input_incomplete', missing, mode: 'preflight_failed' };
  }
  return { status: 'complete', missing: [], mode: 'preflight_ok' };
}

// Collect every candidate source id referenced by any derived fact's provenance
// or any score/archetype driver. Any id that does not resolve to a fact in the
// ledger (or a known common.* field) is DANGLING (B2).
export function validateFactResolution(v2: VerifiedFactsV2): { ok: boolean; dangling: string[] } {
  const resolvable = new Set<string>(Object.keys(v2.facts));
  // Common fields are also resolvable provenance targets. When a common field is a
  // NodeValue/position (angles, nodes, juno, POF), its position fact is surfaced in
  // the facts map as 'natal.<x>.position'; accept both 'common.<x>' and
  // 'common.<x>.position' as resolvable so archetype drivers can reference either.
  for (const f of [
    'common.ascendant', 'common.descendant', 'common.midheaven', 'common.icumcoeli',
    'common.chartRuler', 'common.northNode', 'common.southNode', 'common.juno',
    'common.partOfFortune', 'common.moonPhase', 'common.elements', 'common.modalities',
    'common.aspects', 'common.topAspectByBody', 'common.patterns', 'common.solarSign',
  ]) {
    const field = (v2.common as any)[f.replace('common.', '')];
    if (field !== undefined) {
      resolvable.add(f);
      if (field && typeof field === 'object' && 'position' in field) resolvable.add(`${f}.position`);
      else if (field && typeof field === 'object' && field.longitude !== undefined) resolvable.add(`${f}.position`);
    }
  }

  const dangling: string[] = [];
  const check = (id: string, from: string) => {
    if (!resolvable.has(id)) dangling.push(`${id} (referenced by ${from})`);
  };

  const mark = (f: VerifiedFact) => {
    for (const p of f.provenance || []) check(p, f.id);
  };
  for (const f of Object.values(v2.facts)) mark(f);
  for (const f of [v2.common.chartRuler, v2.common.partOfFortune, v2.common.moonPhase, v2.common.elements, v2.common.modalities]) {
    if (f) mark(f);
  }

  // Score/archetype drivers live under reportData.* and reference fact ids.
  const scanDrivers = (obj: any, path: string) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj.drivers)) for (const d of obj.drivers) check(d, path);
    for (const k of Object.keys(obj)) scanDrivers(obj[k], `${path}.${k}`);
  };
  scanDrivers(v2.reportData, 'reportData');

  return { ok: dangling.length === 0, dangling };
}
