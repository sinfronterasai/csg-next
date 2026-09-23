import { curatedMajorInfluences, curatedMonths, curatedSignificantInfluences, curatedSupportingInfluences, MAX_MONTHLY_PRIMARY, MAX_MONTHLY_SECONDARY, MAX_SUPPORTING_INFLUENCES } from '@/lib/yearlyTransit/curation';
import { buildWorstCaseYearlyTransitPack } from './fixtures/worst-case-pack';

describe('yearly transit curation', () => {
  it('bounds and deterministically selects each monthly influence set', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    const noisy = Array.from({ length: 30 }, (_, i) => ({ ...pack.windows[0], id: `moon-noise-${i}`, canonicalTransitId: `moon-noise-${i}`, mover: 'moon', target: 'sun', importanceScore: 42, importanceBand: 'supporting', activeWindow: { startUtc: '2027-03-01T08:00:00.000Z', endUtc: '2027-03-28T08:00:00.000Z' } }));
    pack.windows = [...pack.windows, ...noisy];
    const first = curatedMonths(pack); const second = curatedMonths(pack);
    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
    for (const month of first) {
      expect(month.primaryInfluences.length).toBeLessThanOrEqual(MAX_MONTHLY_PRIMARY);
      expect(month.secondaryInfluences.length).toBeLessThanOrEqual(MAX_MONTHLY_SECONDARY);
      expect(month.displayName).not.toMatch(/^Month /);
      expect(month.evidenceIds.every((id) => Boolean(pack.facts[id]))).toBe(true);
    }
    expect(first.find((month) => month.key === '2027-03')?.primaryInfluences.filter((item) => item.mover === 'moon')).toHaveLength(0);
  });

  it('groups and curates supporting rows without reusing primary relationships', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    pack.windows[0].mover = 'saturn'; pack.windows[0].target = 'moon'; pack.windows[0].aspectType = 'trine'; pack.windows[0].importanceScore = 72;
    pack.windows[1] = { ...pack.windows[0], id: 'saturn-moon-return', activeWindow: { startUtc: '2027-08-01T08:00:00.000Z', endUtc: '2027-10-01T08:00:00.000Z' } };
    pack.aiPacks.primaryWindows = [{ id: pack.windows[2].id, evidenceIds: pack.windows[2].evidenceIds }];
    const rows = curatedSupportingInfluences(pack);
    const primary = curatedMajorInfluences(pack);
    const significant = curatedSignificantInfluences(pack);
    expect(rows.length).toBeLessThanOrEqual(MAX_SUPPORTING_INFLUENCES);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(significant.filter((row) => row.heading === 'Saturn Trine Moon')).toHaveLength(1);
    expect(rows.some((row) => row.heading === 'Saturn Trine Moon')).toBe(false);
    expect(rows.some((row) => primary.some((major) => major.id === row.id))).toBe(false);
    expect(rows.every((row) => /\.$/.test(row.meaning) && !/perspective to$/i.test(row.meaning))).toBe(true);
  });

  it('keeps Pacific month headings aligned with the report-local period at a UTC boundary', () => {
    const months = curatedMonths(buildWorstCaseYearlyTransitPack());
    expect(months[0].displayName).toBe('January 2027');
    expect(months[11].displayName).toBe('December 2027');
    expect(months.map((month) => month.displayName)).not.toContain('December 2026');
  });

  it('deduplicates key dates that land on the same local calendar day', () => {
    const pack: any = buildWorstCaseYearlyTransitPack();
    pack.windows[1] = { ...pack.windows[1], id: 'same-day-2', target: 'moon', exactHits: [{ ...pack.windows[1].exactHits[0], id: 'same-day-hit-2' }] };
    const month = curatedMonths(pack).find((item) => item.key === '2027-01')!;
    expect(month.keyDates.map((date) => date.label)).toEqual([...new Set(month.keyDates.map((date) => date.label))]);
  });
});
