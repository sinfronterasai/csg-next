import { canonicalSha256 } from './canonical';
import { rankWindows, scoreWindow, type ScoringContext } from './scoring';
import { assertVersionBundle, YEARLY_TRANSIT_VERSIONS } from './versions';
import type { EclipseEvidence, FactRecord, ActiveWindow, NatalTargetObservation, TransitObservation, YearlyTransitFactPack, ImmutableSnapshotInput, UtcPeriod } from './types';

function fact(id: string, kind: FactRecord['kind'], value: unknown, display: string, provenanceIds: string[], calculationUtc: string): FactRecord {
  return { id, kind, value, display, provenanceIds, calculationUtc, precision: 'exact-ephemeris', source: kind === 'position' || kind === 'transit' ? 'swiss-ephemeris' : 'derived-deterministic' };
}

function monthKey(utc: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(utc));
  const year = parts.find((p) => p.type === 'year')?.value; const month = parts.find((p) => p.type === 'month')?.value;
  if (!year || !month) throw new Error(`could not group local month for ${utc}`);
  return `${year}-${month}`;
}

export interface FactPackInput {
  snapshot: ImmutableSnapshotInput;
  period: UtcPeriod;
  displayTimezone: string;
  natalTargets: readonly NatalTargetObservation[];
  observations: readonly TransitObservation[];
  windows: readonly ActiveWindow[];
  eclipses: readonly EclipseEvidence[];
  scoring?: ScoringContext;
}

export function buildYearlyTransitFactPack(input: FactPackInput): YearlyTransitFactPack {
  assertVersionBundle(YEARLY_TRANSIT_VERSIONS);
  try { new Intl.DateTimeFormat('en-US', { timeZone: input.displayTimezone }); } catch { throw new Error(`invalid display timezone: ${input.displayTimezone}`); }
  const scored = rankWindows(input.windows.map((window) => scoreWindow(window, input.scoring)));
  const primary = scored.filter((window) => window.importanceScore >= 75).slice(0, 8);
  const context = scored.filter((window) => window.importanceScore >= 60 && window.importanceScore < 75);
  const appendix = scored.filter((window) => window.importanceScore >= 40 && window.importanceScore < 60);
  const facts: Record<string, FactRecord> = {};
  for (const target of input.natalTargets) facts[target.factId] = fact(target.factId, 'position', target, `${target.label} natal position`, [], input.snapshot.generatedAtUtc);
  for (const observation of input.observations) facts[observation.factId] = fact(observation.factId, 'transit', observation, `${observation.body} transit position`, [], observation.calculationUtc);
  for (const window of scored) {
    const evidenceIds = [`${window.id}.window`, ...window.exactHits.map((hit) => hit.id)];
    facts[`${window.id}.window`] = fact(`${window.id}.window`, 'window', window, `${window.mover} ${window.aspectType} ${window.target} active window`, [], window.activeWindow.startUtc);
    for (const hit of window.exactHits) facts[hit.id] = fact(hit.id, 'exact-hit', hit, `${window.mover} exact ${window.aspectType} ${window.target}`, [], hit.exactUtc);
    window.evidenceIds = evidenceIds;
  }
  for (const eclipse of input.eclipses) facts[eclipse.factId] = fact(eclipse.factId, 'eclipse', eclipse, `${eclipse.type} eclipse`, [], eclipse.exactUtc);
  const primaryWindows = primary.map((window) => ({ id: window.id, evidenceIds: [...window.evidenceIds] }));
  const monthlyMap = new Map<string, { id: string; evidenceIds: string[] }>();
  for (const window of context) {
    const key = monthKey(window.activeWindow.startUtc, input.displayTimezone);
    const item = monthlyMap.get(key) ?? { id: `month.${key}`, evidenceIds: [] };
    item.evidenceIds.push(...window.evidenceIds); monthlyMap.set(key, item);
  }
  const monthlyContext = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 12).map(([, item]) => ({ id: item.id, evidenceIds: [...new Set(item.evidenceIds)] }));
  const appendixEvidence = appendix.map((window) => ({ id: window.id, evidenceIds: [...window.evidenceIds] }));
  const unsigned: Omit<YearlyTransitFactPack, 'canonicalJsonSha256'> = {
    schemaVersion: 'csg-yearly-transit-fact-pack-v1', reportType: 'yearlytransit', snapshotId: input.snapshot.snapshotId, snapshot: input.snapshot, period: input.period,
    displayTimezone: input.displayTimezone, natalTargets: [...input.natalTargets], movingBodies: ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'], observations: [...input.observations], windows: scored, eclipses: [...input.eclipses], facts,
    aiPacks: { primaryWindows, monthlyContext, appendixEvidence }, versionBundle: YEARLY_TRANSIT_VERSIONS,
  };
  return { ...unsigned, canonicalJsonSha256: canonicalSha256(unsigned) };
}
