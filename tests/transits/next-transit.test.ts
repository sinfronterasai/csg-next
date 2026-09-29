import type { ActiveWindow, YearlyTransitFactPack } from '@/lib/yearlyTransit/types';
import { NEXT_TRANSIT_CONTRACT_VERSION, selectNextMajorTransit } from '@/lib/nextTransit';

function window(overrides: Partial<ActiveWindow> = {}): ActiveWindow {
  return {
    id: 'yt.window.jupiter.venus.trine',
    canonicalTransitId: 'jupiter.venus.trine',
    passIndex: 1,
    mover: 'jupiter',
    target: 'venus',
    aspectType: 'trine',
    activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-10T00:00:00Z' },
    minimumActiveError: 0.2,
    house: 7,
    retrograde: false,
    segments: [],
    exactHits: [{ id: 'hit-1', exactUtc: '2026-10-05T00:00:00Z', exactError: 0.01, direction: 'applying', retrograde: false, factId: 'fact-1' }],
    duration: 9 * 86400000,
    rawImportanceScore: 80,
    importanceScore: 80,
    importanceBand: 'major',
    evidenceIds: ['fact-1'],
    ...overrides,
  };
}

function pack(windows: ActiveWindow[]): YearlyTransitFactPack {
  return {
    schemaVersion: 'csg-yearly-transit-fact-pack-v1',
    reportType: 'yearlytransit',
    snapshotId: 'snapshot-1',
    snapshot: {
      snapshotId: 'snapshot-1',
      generatedAtUtc: '2026-09-28T00:00:00Z',
      birthData: { date: '1980-03-09', time: '16:21', latitude: 36.9741, longitude: -122.0308, timezone: 'America/Los_Angeles' },
    },
    period: { fromUtc: '2026-09-28T00:00:00Z', toUtc: '2027-09-28T00:00:00Z' },
    displayTimezone: 'America/Los_Angeles',
    natalTargets: [],
    movingBodies: ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'],
    observations: [],
    windows,
    eclipses: [],
    facts: { internal: { id: 'internal', kind: 'meta', source: 'derived-deterministic', value: {}, display: '', provenanceIds: [], calculationUtc: '2026-09-28T00:00:00Z', precision: 'exact-ephemeris' } },
    aiPacks: { primaryWindows: [], monthlyContext: [], appendixEvidence: [] },
    versionBundle: { transitEngineVersion: 'test', importancePolicyVersion: 'yt-importance-v1.0.0', eclipsePolicyVersion: 'test', factPackVersion: 'test', aiContractVersion: 'test', reportTemplateVersion: 'test' },
    canonicalJsonSha256: 'test',
  };
}

describe('next-major-transit deterministic contract', () => {
  it('prefers the highest-ranked active major candidate over a future candidate', () => {
    const active = window({ id: 'active', canonicalTransitId: 'jupiter.venus.trine', activeWindow: { startUtc: '2026-09-20T00:00:00Z', endUtc: '2026-10-20T00:00:00Z' }, importanceScore: 75, rawImportanceScore: 75 });
    const future = window({ id: 'future', canonicalTransitId: 'saturn.sun.square', activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-12T00:00:00Z' }, importanceScore: 100, rawImportanceScore: 100 });
    expect(selectNextMajorTransit(pack([future, active]), '2026-09-28T12:00:00Z').nextTransit).toMatchObject({ mover: 'jupiter', target: 'venus', aspect: 'trine' });
  });

  it('chooses the earliest future period, then the existing comparator, then canonicalTransitId', () => {
    const later = window({ id: 'later', canonicalTransitId: 'saturn.sun.square', activeWindow: { startUtc: '2026-12-01T00:00:00Z', endUtc: '2026-12-10T00:00:00Z' }, importanceScore: 100, rawImportanceScore: 100 });
    const first = window({ id: 'first', canonicalTransitId: 'jupiter.venus.trine', activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-10T00:00:00Z' }, importanceScore: 75, rawImportanceScore: 75 });
    const tie = window({ id: 'tie', canonicalTransitId: 'mars.moon.square', activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-10T00:00:00Z' }, importanceScore: 75, rawImportanceScore: 75 });
    expect(selectNextMajorTransit(pack([later, tie, first]), '2026-09-28T12:00:00Z').nextTransit).toMatchObject({ mover: 'jupiter', target: 'venus', aspect: 'trine' });
  });

  it('counts significant transit periods at the 60 threshold and exposes only the bounded DTO', () => {
    const result = selectNextMajorTransit(pack([
      window({ id: 'major', importanceScore: 75 }),
      window({ id: 'meaningful', importanceScore: 60, canonicalTransitId: 'saturn.sun.square' }),
      window({ id: 'supporting', importanceScore: 59, canonicalTransitId: 'mars.moon.square' }),
    ]), '2026-09-28T12:00:00Z');
    expect(result.significantTransitCount).toBe(2);
    expect(result.contractVersion).toBe(NEXT_TRANSIT_CONTRACT_VERSION);
    expect(Object.keys(result)).toEqual(['nextTransit', 'significantTransitCount', 'searchPeriod', 'contractVersion']);
    expect(JSON.stringify(result)).not.toMatch(/windows|facts|eclipses|aiPacks|importanceScore|evidenceIds|canonicalJsonSha256|pdf|ics/);
  });
});
