import type { ActiveWindow, FactRecord, YearlyTransitFactPack } from '@/lib/yearlyTransit/types';
import { canonicalSha256 } from '@/lib/yearlyTransit/canonical';
import { YEARLY_TRANSIT_VERSIONS } from '@/lib/yearlyTransit/versions';

const longText = 'A grounded interpretation with practical agency and evidence-linked context. '.repeat(28);
const evidence = (id: string): FactRecord => ({
  id, kind: 'meta', source: 'derived-deterministic', value: { label: id }, display: `${id}: verified evidence`, provenanceIds: [], calculationUtc: '2027-01-01T00:00:00.000Z', precision: 'exact-ephemeris',
});

function windowFor(index: number): ActiveWindow {
  const id = `yt.window.jupiter.sun.conjunction.${index}`;
  const start = `2027-${String((index % 12) + 1).padStart(2, '0')}-01T00:00:00.000Z`;
  const end = `2027-${String((index % 12) + 1).padStart(2, '0')}-15T00:00:00.000Z`;
  return {
    id, canonicalTransitId: id, mover: 'jupiter', target: 'sun', aspectType: 'conjunction',
    activeWindow: { startUtc: start, endUtc: end }, minimumActiveError: 0.24, house: 10, retrograde: false,
    segments: [{ startUtc: start, endUtc: end, direction: 'applying' }],
    exactHits: [{ id: `${id}.1.2027-01-08T00:00:00Z`, exactUtc: '2027-01-08T00:00:00Z', exactError: 0.02, direction: 'applying', retrograde: false, factId: `${id}.exact` }],
    rawImportanceScore: 95, importanceScore: 95, importanceBand: 'defining', evidenceIds: [`fact.window.${index}`],
  };
}

export function buildWorstCaseYearlyTransitPack(): YearlyTransitFactPack {
  const windows = Array.from({ length: 8 }, (_, i) => windowFor(i));
  const facts: Record<string, FactRecord> = {};
  for (let i = 0; i < 8; i++) facts[`fact.window.${i}`] = { ...evidence(`fact.window.${i}`), display: longText };
  for (let i = 0; i < 12; i++) facts[`fact.month.${i}`] = { ...evidence(`fact.month.${i}`), display: longText };
  facts['fact.appendix'] = { ...evidence('fact.appendix'), display: longText };
  const pack: Omit<YearlyTransitFactPack, 'canonicalJsonSha256'> = {
    schemaVersion: 'csg-yearly-transit-fact-pack-v1', reportType: 'yearlytransit', snapshotId: 'snapshot-worst-case',
    snapshot: { snapshotId: 'snapshot-worst-case', generatedAtUtc: '2027-01-01T00:00:00Z', birthData: { date: '1980-03-09', time: '16:21', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' } },
    period: { fromUtc: '2027-01-01T08:00:00.000Z', toUtc: '2028-01-01T08:00:00.000Z' }, displayTimezone: 'America/Los_Angeles',
    natalTargets: [], movingBodies: ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'], observations: [], windows,
    eclipses: [], facts,
    aiPacks: { primaryWindows: windows.map((w) => ({ id: w.id, evidenceIds: w.evidenceIds })), monthlyContext: Array.from({ length: 12 }, (_, i) => ({ id: `month.${i}`, evidenceIds: [`fact.month.${i}`] })), appendixEvidence: [{ id: 'appendix.0', evidenceIds: ['fact.appendix'] }] },
    versionBundle: YEARLY_TRANSIT_VERSIONS,
  };
  return { ...pack, canonicalJsonSha256: canonicalSha256(pack) };
}
