export const YEARLY_TRANSIT_REPORT_TYPE = 'yearlytransit' as const;
export type YearlyTransitReportType = typeof YEARLY_TRANSIT_REPORT_TYPE;

export type MovingBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
export type NatalTarget = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto' | 'asc' | 'mc' | 'northnode' | 'chiron';
export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export type TransitDirection = 'applying' | 'separating' | 'stationary' | 'indeterminate';
export type ImportanceBand = 'defining' | 'major' | 'meaningful' | 'supporting' | 'omit';
export type EclipseType = 'solar' | 'lunar';

export interface VersionBundle {
  transitEngineVersion: string;
  importancePolicyVersion: string;
  eclipsePolicyVersion: string;
  factPackVersion: string;
  aiContractVersion: string;
  reportTemplateVersion: string;
}

export interface ImmutableSnapshotInput {
  snapshotId: string;
  generatedAtUtc: string;
  birthData: {
    date: string;
    time: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
}

export interface UtcPeriod {
  fromUtc: string;
  toUtc: string;
}

export interface NatalTargetObservation {
  key: NatalTarget;
  label: string;
  longitude: number;
  house: number | null;
  source: 'swiss-ephemeris' | 'derived-deterministic';
  factId: string;
}

export interface TransitObservation {
  body: MovingBody;
  longitude: number;
  retrograde: boolean;
  calculationUtc: string;
  precision: 'exact-ephemeris';
  factId: string;
}

export interface ExactHit {
  id: string;
  exactUtc: string;
  exactError: number;
  direction: TransitDirection;
  retrograde: boolean;
  factId: string;
}

export interface ActiveWindow {
  id: string;
  canonicalTransitId: string;
  passIndex?: number;
  mover: MovingBody;
  target: NatalTarget;
  aspectType: AspectType;
  activeWindow: { startUtc: string; endUtc: string };
  minimumActiveError: number;
  house: number | null;
  retrograde: boolean;
  segments: Array<{ startUtc: string; endUtc: string; direction: TransitDirection }>;
  exactHits: ExactHit[];
  duration?: number;
  rawImportanceScore: number;
  importanceScore: number;
  importanceBand: ImportanceBand;
  evidenceIds: string[];
}

export interface EclipseEvidence {
  id: string;
  type: EclipseType;
  exactUtc: string;
  axisLongitude: number;
  axisContact: 'axisA' | 'axisB';
  proximityByTarget: Record<NatalTarget, number>;
  source: 'swiss-eclipse-api' | 'verified-geometry-fallback';
  flags: number;
  precision: 'exact-ephemeris';
  policyVersion: string;
  factId: string;
}

export interface FactRecord {
  id: string;
  kind: 'position' | 'transit' | 'window' | 'exact-hit' | 'eclipse' | 'score' | 'meta';
  source: 'swiss-ephemeris' | 'derived-deterministic';
  value: unknown;
  display: string;
  provenanceIds: string[];
  calculationUtc: string;
  precision: string;
}

export interface AiPackItem {
  id: string;
  evidenceIds: string[];
}

export interface YearlyTransitAiPacks {
  primaryWindows: AiPackItem[];
  monthlyContext: AiPackItem[];
  appendixEvidence: AiPackItem[];
}

export interface YearlyTransitFactPack {
  schemaVersion: 'csg-yearly-transit-fact-pack-v1';
  reportType: YearlyTransitReportType;
  snapshotId: string;
  snapshot: ImmutableSnapshotInput;
  period: UtcPeriod;
  displayTimezone: string;
  natalTargets: NatalTargetObservation[];
  movingBodies: MovingBody[];
  observations: TransitObservation[];
  windows: ActiveWindow[];
  eclipses: EclipseEvidence[];
  facts: Record<string, FactRecord>;
  aiPacks: YearlyTransitAiPacks;
  versionBundle: VersionBundle;
  canonicalJsonSha256: string;
}
