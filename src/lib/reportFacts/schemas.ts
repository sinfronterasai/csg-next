// Per-report required-field contracts + deterministic preflight validator.
//
// A non-empty object is NOT sufficient. Each report type declares the exact fact
// ids it requires. `preflightReport` returns `input_incomplete` with a
// machine-readable list of missing ids (never rendered to the customer). On
// incomplete, the caller must NOT dispatch and must leave the purchase retryable.

import type { ReportType, VerifiedFactsV2, PreflightResult } from './types';

// Stable fact ids every natal-based report must have before generation.
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

// Body-level positions required in `facts` (keyed by their stable fact id under facts.).
const BODY_REQUIRED = [
  'facts.natal.sun.position',
  'facts.natal.moon.position',
  'facts.natal.mercury.position',
  'facts.natal.venus.position',
  'facts.natal.mars.position',
  'facts.natal.jupiter.position',
  'facts.natal.saturn.position',
  'facts.natal.ascendant.position',
  'facts.natal.midheaven.position',
];

// Report-specific required field groups (beyond common + body).
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
  ],
  vocation: [
    'reportData.vocationArchetype',
  ],
  karmicshadow: [
    'reportData.karmic',
  ],
  // Timing reports require a full 12-month event ledger (built in P6/P7). Until
  // then preflight fails closed so no truncated timing report is dispatched.
  lovetiming: ['reportData.transitLedger'],
  yearlytransit: ['reportData.transitLedger'],
  // Full Cosmic requires approved component versions (assembled in P8).
  fullcosmic: ['reportData.componentManifest'],
};

function descend(obj: any, parts: string[]): boolean {
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return false;
    if (!(part in cur)) return false;
    cur = cur[part];
  }
  return true;
}

// Supports both flat keys (facts map is keyed by the full fact id, e.g.
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
  const required = [...COMMON_REQUIRED, ...BODY_REQUIRED, ...(REPORT_REQUIRED[reportType] || [])];
  const missing = required.filter((id) => !hasPath(v2, id));
  if (missing.length > 0) {
    return { status: 'input_incomplete', missing, mode: 'preflight_failed' };
  }
  return { status: 'complete', missing: [], mode: 'preflight_failed' };
}
