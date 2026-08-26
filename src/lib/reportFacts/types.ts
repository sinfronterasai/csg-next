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
  id: string; // stable, e.g. "natal.venus.position" or "natal.aspect.venus-mars-square"
  kind: FactKind;
  source: FactSource;
  // Renderer-owned exact display string. The writer MUST NOT recompute this.
  display: string;
  value: unknown;
  // For derived facts: the ids of the source facts used to compute this one.
  // REQUIRED for every 'derived-deterministic' fact (R2-B10). May be empty only
  // for authoritative 'swiss-ephemeris' root facts.
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
  // True when the exact longitude is not authoritative (e.g. unknown-time noon
  // approximation) so the writer will not cite it as precise evidence.
  uncertain?: boolean;
  // F4-4: Part of Fortune sect/formula metadata
  sect?: 'day' | 'night';
  formula?: string; // stable formula identifier, e.g. 'day:ASC+MOON-SUN' or 'night:ASC+SUN-MOON'
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

// ---- House / ruler structures (R2-B6) ----

export interface HouseCusp {
  num: number;
  cuspLongitude: number;
  sign: string;
  signLabel: string;
}

export interface RulerFact {
  house: number | 'nodal'; // house number; 'nodal' is the locked sentinel for node rulers
  ruler: string; // planet key, e.g. 'venus'
  rulerLabel: string;
  sign: string; // actual ruler planet's natal sign
  degreeInSign: number; // actual ruler planet's degree within sign
  house_of_ruler: number | null; // house placement of the ruler planet
  retrograde: boolean; // retrograde status of the ruler planet
  dignity: Dignity; // explicit dignity/condition enum
  condition: string; // dignity condition string (derived from dignity)
  provenance: string[]; // source fact ids (the cusp + the ruler planet position)
}

export interface OccupantRef {
  body: string; // planet key
  label: string;
  positionId: string; // fact id of the occupant's position fact
}

export interface HouseOccupants {
  house: number;
  occupants: OccupantRef[];
}

// ---- A4 report-specific evidence bundles (R2-B4) ----

export interface AspectEvidence {
  pair: string; // e.g. "venus-mars"
  aspectType: string | null; // null if no aspect within orb
  aspectId: string | null; // fact id if present
  provenance: string[];
}

export interface RelationshipEvidence {
  seventhHouseRuler: RulerFact;
  seventhHouseOccupants: HouseOccupants;
  aspects: {
    venusMars: AspectEvidence;
    mercuryVenus: AspectEvidence;
    moonVenus: AspectEvidence;
    venusSaturn: AspectEvidence;
  };
  junoCondition: string;
  scoreDrivers: string[];
}

export interface LoveBlueprintEvidence {
  aspects: {
    moonVenus: AspectEvidence;
    venusMars: AspectEvidence;
    junoSaturn: AspectEvidence;
  };
  dscRuler: RulerFact;
  dscOccupants: HouseOccupants;
  chironAspects: string[]; // aspect fact ids (filtered to Venus/Moon ties)
  chironEvidence: OptionalEvidence; // F5-4: explicit present/absent state
  northNodeSign: string;
  scoreDrivers: string[];
}

export interface VocationEvidence {
  mcRuler: RulerFact; // 10th house ruler
  secondRuler: RulerFact; // 2nd house ruler
  sixthRuler: RulerFact; // 6th house ruler
  // F5-9: complete MC package
  mcPositionId: string;
  mcSign: string;
  mcDegreeInSign: number;
  mcAspects: string[]; // sorted aspect fact ids involving MC
  saturnAspect: AspectEvidence; // to MC
  jupiterAspect: AspectEvidence;
  plutoAspect: AspectEvidence;
  wealthIndicators: string[]; // fact ids / labels
  careerWindowsDeclared: boolean; // 24-month windows are P6/P7; declared + fail closed
}

export interface OptionalEvidence {
  present: boolean; // true if cited, false if explicitly absent
  ids: string[]; // fact ids when present
  reason?: string; // deterministic reason when absent
}

export interface KarmicEvidence {
  northNodeHouse: number | null;
  southNodeHouse: number | null;
  northNodeRuler: RulerFact;
  southNodeRuler: RulerFact;
  nodalAspects: string[]; // aspect fact ids involving a node
  nodalSquares: string[];
  saturnEvidence: AspectEvidence;
  plutoEvidence: AspectEvidence;
  chironAspects: string[]; // aspect fact ids (filtered to node ties)
  chironEvidence: OptionalEvidence; // F5-4: explicit present/absent
}

export interface VerifiedFactsV2 {
  schemaVersion: 'csg-report-facts-v2';
  reportType: ReportType;
  asOfDate: string; // ISO date; immutable snapshot
  common: CommonDerived;
  facts: Record<string, VerifiedFact>;
  reportData: Record<string, unknown>;
}

export interface CommonDerived {
  positions: VerifiedFact[];
  ascendant?: NodeValue;
  descendant?: NodeValue;
  midheaven?: NodeValue;
  icumcoeli?: NodeValue;
  chartRuler?: VerifiedFact;
  northNode: NodeValue;
  southNode: NodeValue;
  juno: NodeValue;
  partOfFortune?: VerifiedFact; // value includes sect + formula metadata (F4-4)
  moonPhase?: VerifiedFact;
  elements: VerifiedFact;
  modalities: VerifiedFact;
  houses?: HouseCusp[]; // 12 cusps (R2-B6)
  rulers?: {
    dsc?: RulerFact; // 7th house ruler
    second?: RulerFact; // 2nd house ruler
    sixth?: RulerFact; // 6th house ruler
    tenth?: RulerFact; // 10th house ruler (MC)
  };
  occupants?: HouseOccupants[]; // bodies per house
  nodalRulers?: { north: RulerFact; south: RulerFact };
  aspects: AspectFact[];
  topAspectByBody: VerifiedFact; // stable citable fact: per-body tightest aspect (R2-B10)
  patterns: PatternFact[];
  isSolarFallback: boolean;
  solarSign?: { sun: string; sunLabel: string; moon?: { sign: string; signLabel: string; invariant: boolean } };
}

export interface TopAspectValue {
  body: string; // planet/angle key
  aspectId: string; // fact id of the tightest aspect for this body
  orb: number; // the tightest orb
}

export interface AspectValue {
  bodyA: string;
  bodyB: string;
  aspectType: string;
  orb: number;
  tight: boolean; // orb < 1 (tightness threshold, editorial)
  exact: boolean; // orb < epsilon (effectively exact under documented rounding rule)
  bodyALabel: string;
  bodyBLabel: string;
  weight: number;
  minor: boolean; // true for a minor aspect (R2-B7)
}

// Tightness semantics (R2-B11): explicit per pattern type.
//  - stellium: angular span = max(degreeInSign) - min(degreeInSign) across participants (degrees).
//  - grandTrine: max orb among the three trine aspects (degrees).
//  - tSquare: max orb among the three aspects (two squares + one opposition).
//  - yod: max orb among the three aspects (two quincunxes + one sextile).
export interface PatternRole {
  base: string[]; // the two base-participant keys (semantic)
  apex: string; // the apex-participant key (semantic)
}

export interface PatternValue {
  name: 'Stellium' | 'GrandTrine' | 'TSquare' | 'Yod';
  participants: string[]; // canonicalized sorted labels
  tightness: number;
  tightnessSemantics: 'angular-span' | 'max-orb';
  roles?: PatternRole; // typed semantic roles (base pair + apex)
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

export interface PreflightResult {
  status: PreflightStatus;
  missing: string[];
  mode: 'preflight_ok' | 'preflight_failed';
}

export interface DriverResolution {
  ok: boolean;
  dangling: string[];
}
