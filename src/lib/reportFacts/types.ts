// VerifiedFactsV2 — versioned, normalized, deterministic fact ledger.
//
// This is the ONLY source of celestial truth the report pipeline consumes. Every
// fact has a stable id, an exact deterministic display string, and (for derived
// facts) provenance listing the source fact ids it was computed from. The writer
// model never recomputes degrees, signs, or aspects; it only interprets these.

export type FactSource = 'swiss-ephemeris' | 'derived-deterministic';
export type FactKind =
  | 'position'
  | 'point'
  | 'aspect'
  | 'tally'
  | 'phase'
  | 'pattern'
  | 'score'
  | 'transit'
  | 'meta';

export interface VerifiedFact {
  id: string; // stable, e.g. "natal.venus.position" or "natal.aspect.venus-saturn-square"
  kind: FactKind;
  source: FactSource;
  // Renderer-owned exact display string, e.g. "Venus at 18.68° Taurus in the 9th house".
  // The writer MUST NOT recompute this; it cites the id and the renderer shows display.
  display: string;
  value: unknown;
  // For derived facts: the ids of the source facts used to compute this one.
  provenance?: string[];
}

export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall' | null;

export interface PositionValue {
  key: string;
  label: string;
  longitude: number; // 0..360 internal
  degreeInSign: number; // 0..<30 customer display
  sign: string;
  signLabel: string;
  house: number | null;
  retrograde: boolean;
  dignity: Dignity;
  // For points whose exact longitude is not authoritative (e.g. unknown-time Moon)
  // this flag marks the value as approximate/uncertain so the writer will not cite
  // it as precise evidence.
  uncertain?: boolean;
}

export interface NodeValue extends PositionValue {
  display: string;
}

export type ReportType =
  | 'natal'
  | 'relationship'
  | 'loveblueprint'
  | 'lovetiming'
  | 'yearlytransit'
  | 'vocation'
  | 'karmicshadow'
  | 'fullcosmic';

export const REPORT_TYPES: ReportType[] = [
  'natal', 'relationship', 'loveblueprint', 'lovetiming', 'yearlytransit', 'vocation', 'karmicshadow', 'fullcosmic',
];

export function validateReportType(t: string): t is ReportType {
  return (REPORT_TYPES as string[]).includes(t);
}

export interface VerifiedFactsV2 {
  schemaVersion: 'csg-report-facts-v2';
  reportType: ReportType;
  asOfDate: string; // ISO date the facts are computed "as of" (immutable snapshot)
  common: CommonDerived;
  facts: Record<string, VerifiedFact>;
  reportData: Record<string, unknown>;
}

// Common derived layer available to every report that has a natal chart.
// Every citable value is surfaced as a VerifiedFact with a stable id so future
// exact-citation validation can resolve ALL narrative evidence to one fact id.
export interface CommonDerived {
  positions: VerifiedFact[];
  // Time-dependent fields are OMITTED (undefined) under unknown-time (solar)
  // fallback. They must never be fabricated. Preflight for time-dependent reports
  // then fails closed. Solar fallback uses a reduced, sign-level schema instead.
  ascendant?: NodeValue;
  descendant?: NodeValue;
  midheaven?: NodeValue;
  icumcoeli?: NodeValue;
  chartRuler?: VerifiedFact; // kind 'point', provenance = [ascendant sign fact]
  northNode: NodeValue;
  southNode: NodeValue;
  juno: NodeValue;
  partOfFortune?: VerifiedFact; // kind 'point', provenance = [ascendant, moon, sun]
  moonPhase: VerifiedFact; // kind 'phase'
  elements: VerifiedFact; // kind 'tally'
  modalities: VerifiedFact; // kind 'tally'
  aspects: AspectFact[];
  topAspectByBody: Record<string, string>; // body key -> tightest-aspect fact id (both sides)
  patterns: PatternFact[];
  // True when the chart was computed without a birth time; time-dependent facts
  // are intentionally absent and only sign-level (solar) facts are authoritative.
  isSolarFallback: boolean;
  // Under solar fallback, the reduced authoritative set is surfaced here.
  solarSign?: { sun: string; sunLabel: string; moon: string; moonLabel: string };
}

export interface AspectValue {
  bodyA: string;
  bodyB: string;
  aspectType: string; // conjunction|sextile|square|trine|opposition
  orb: number;
  exact: boolean;
  bodyALabel: string;
  bodyBLabel: string;
  // Weighted contribution to relationship/synthesis scoring (see scores.ts policy).
  weight: number;
}

export interface PatternValue {
  name: string;
  participants: string[];
  tightness: number; // real tightness measure (max orb among participants), not count
}

export interface AspectFact extends VerifiedFact {
  kind: 'aspect';
  value: AspectValue;
}

export interface PatternFact extends VerifiedFact {
  kind: 'pattern';
  value: PatternValue;
}

export type PreflightStatus = 'complete' | 'input_incomplete';

// Machine-readable preflight result. On incomplete, `missing` lists the exact
// required field ids that were absent. This is NEVER rendered to the customer.
export interface PreflightResult {
  status: PreflightStatus;
  missing: string[];
  // Explicit success/failure semantics (was always 'preflight_failed' before).
  mode: 'preflight_ok' | 'preflight_failed';
}

// A gate validator that rejects any fact whose provenance/driver id does not
// resolve to an existing fact in the ledger.
export interface DriverResolution {
  ok: boolean;
  dangling: string[];
}
