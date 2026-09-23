import { buildYearlyTransitPresentation, displayTransit, groupTransitWindows, toCustomerYearlyTransitPresentation } from '@/lib/yearlyTransit/presentation';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';

describe('yearly transit customer presentation model', () => {
  it('humanizes deterministic transit names and never exposes engine casing', () => {
    expect(displayTransit({ mover: 'jupiter', target: 'asc', aspectType: 'conjunction' } as any)).toBe('Jupiter Conjunct Ascendant');
  });

  it('consolidates multi-pass windows by mover, target, and aspect', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    pack.windows = [
      { ...pack.windows[0], mover: 'jupiter', target: 'mc', aspectType: 'square', id: 'pass-1', canonicalTransitId: 'jupiter-mc-square', activeWindow: { startUtc: '2026-09-01T00:00:00.000Z', endUtc: '2026-10-01T00:00:00.000Z' }, exactHits: [{ id: 'hit-1', exactUtc: '2026-09-15T00:00:00.000Z', direction: 'applying', retrograde: false }], segments: [{ startUtc: '2026-09-01T00:00:00.000Z', endUtc: '2026-10-01T00:00:00.000Z', direction: 'applying' }], evidenceIds: ['pass-1.window'] },
      { ...pack.windows[0], mover: 'jupiter', target: 'mc', aspectType: 'square', id: 'pass-2', canonicalTransitId: 'jupiter-mc-square', activeWindow: { startUtc: '2027-02-01T00:00:00.000Z', endUtc: '2027-06-01T00:00:00.000Z' }, exactHits: [{ id: 'hit-2', exactUtc: '2027-03-15T00:00:00.000Z', direction: 'separating', retrograde: true }], segments: [{ startUtc: '2027-02-01T00:00:00.000Z', endUtc: '2027-06-01T00:00:00.000Z', direction: 'separating' }], evidenceIds: ['pass-2.window'] },
    ];
    const grouped = groupTransitWindows(pack);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ heading: 'Jupiter Square Midheaven', passCount: 2, exactHits: [{ utc: '2026-09-15T00:00:00.000Z' }, { utc: '2027-03-15T00:00:00.000Z' }] });
    expect(grouped[0].phases.map((phase) => phase.label)).toEqual(['Applying', 'Retrograde return']);
  });

  it('creates twelve customer-facing month sections including quiet months', () => {
    const presentation = buildYearlyTransitPresentation(buildWorstCaseYearlyTransitPack());
    expect(presentation.monthly).toHaveLength(12);
    expect(presentation.monthly.every((month) => !month.label.startsWith('Month '))).toBe(true);
    expect(presentation.monthly.some((month) => month.summary === 'Integration and consolidation')).toBe(true);
  });

  it('keeps UTC fields and evidence IDs out of the public customer DTO', () => {
    const publicView = toCustomerYearlyTransitPresentation(buildYearlyTransitPresentation(buildWorstCaseYearlyTransitPack()));
    const serialized = JSON.stringify(publicView);
    expect(serialized).not.toContain('2027-05-04T09:42:46.000Z');
    expect(serialized).not.toContain('evidenceIds');
    expect(serialized).not.toContain('importanceScore');
    expect(publicView.periodLabel).not.toContain('T');
  });

  it('does not repeat non-primary passes in the appendix', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    pack.aiPacks.primaryWindows = [{ id: pack.windows[0].id, evidenceIds: pack.windows[0].evidenceIds }];
    const presentation = buildYearlyTransitPresentation(pack);
    expect(presentation.appendix.some((item) => item.transit === 'Jupiter Conjunct Sun')).toBe(false);
  });
});
