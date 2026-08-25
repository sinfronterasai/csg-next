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
  id: string;
  kind: FactKind;
  source: FactSource;
  display: string;
  value: unknown;
  provenance?: string[];
}

export type Dignity = 'domicile' | 'exaltation' | 'detriment' | 'fall' | null;

export interface PositionValue {
  key: string;
  label: string;
  longitude: number;
  degreeInSign: number;
  sign: string;
  signLabel: string;
  house: number | null;
  retrograde: boolean;
  dignity: Dignity;
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

export interface VerifiedFactsV2 {
  schemaVersion: 'csg-report-facts-v2';
  reportType: ReportType;
  asOfDate: string;
  common: CommonDerived;
  facts: Record<string, VerifiedFact>;
  reportData: Record<string, unknown>;
}

export interface AspectValue {
  bodyA: string;
  bodyB: string;
  aspectType: string;
  orb: number;
  exact: boolean;
  bodyALabel: string;
  bodyBLabel: string;
}

export interface PatternValue {
  name: string;
  participants: string[];
  tightness: number;
}

export interface AspectFact extends VerifiedFact {
  kind: 'aspect';
  value: AspectValue;
}

export interface PatternFact extends VerifiedFact {
  kind: 'pattern';
  value: PatternValue;
}

export interface CommonDerived {
  positions: VerifiedFact[];
  // Time-dependent fields are OMITTED (undefined) under unknown-time (solar)
  // fallback. They must never be fabricated. Preflight for time-dependent reports
  // then fails closed.
  ascendant?: { sign: string; signLabel: string; degreeInSign: number; house: 1 };
  descendant?: { sign: string; signLabel: string; degreeInSign: number; house: 7 };
  midheaven?: { sign: string; signLabel: string; degreeInSign: number; house: 10 };
  icumcoeli?: { sign: string; signLabel: string; degreeInSign: number; house: 4 };
  chartRuler?: { planet: string; label: string; sign: string; condition: string; display: string };
  northNode: NodeValue;
  southNode: NodeValue;
  juno: NodeValue;
  partOfFortune?: NodeValue;
  moonPhase: { phase: number; label: string };
  elements: Record<string, number>;
  modalities: Record<string, number>;
  aspects: AspectFact[];
  topAspectByBody: Record<string, string>;
  patterns: PatternFact[];
  // True when the chart was computed without a birth time; time-dependent facts
  // are intentionally absent.
  isSolarFallback: boolean;
}

export type PreflightStatus = 'complete' | 'input_incomplete';

export interface PreflightResult {
  status: PreflightStatus;
  missing: string[];
  mode: 'preflight_failed';
}
