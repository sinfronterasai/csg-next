import { compareImportance, importanceBand, rankWindows, scoreWindow } from '@/lib/yearlyTransit/scoring';
import type { ActiveWindow } from '@/lib/yearlyTransit/types';

function window(overrides: Partial<ActiveWindow> = {}): ActiveWindow {
  return { id: 'w', canonicalTransitId: 'jupiter.asc.conjunction', mover: 'jupiter', target: 'asc', aspectType: 'conjunction',
    activeWindow: { startUtc: '2027-01-01T00:00:00Z', endUtc: '2027-02-01T00:00:00Z' }, minimumActiveError: 0.2, house: 1, retrograde: false,
    segments: [], exactHits: [{ id: 'h1', exactUtc: '2027-01-15T00:00:00Z', exactError: 0.01, direction: 'applying', retrograde: false, factId: 'f1' }, { id: 'h2', exactUtc: '2027-01-20T00:00:00Z', exactError: 0.02, direction: 'separating', retrograde: false, factId: 'f2' }],
    rawImportanceScore: 0, importanceScore: 0, importanceBand: 'omit', evidenceIds: [], ...overrides };
}

describe('yearly transit importance policy', () => {
  it('applies each applicable rule once and caps only public score', () => {
    const scored = scoreWindow(window(), { houseRulerRelevant: true });
    expect(scored.rawImportanceScore).toBe(91);
    expect(scored.importanceScore).toBe(91);
    expect(scored.duration).toBe(31 * 24 * 60 * 60 * 1000);
    expect(scored.importanceBand).toBe('defining');
    expect(importanceBand(100)).toBe('defining');
    expect(importanceBand(89)).toBe('major');
    expect(importanceBand(74)).toBe('meaningful');
    expect(importanceBand(59)).toBe('supporting');
    expect(importanceBand(39)).toBe('omit');
  });

  it('uses raw score, duration, exact-hit count, start, then ID for ties', () => {
    const a = scoreWindow(window({ id: 'a', canonicalTransitId: 'a', minimumActiveError: 1, exactHits: [] }));
    const b = scoreWindow(window({ id: 'b', canonicalTransitId: 'b', minimumActiveError: 1, exactHits: [] }));
    expect(compareImportance(a, b)).toBeLessThan(0);
    expect(rankWindows([b, a]).map((x) => x.id)).toEqual(['a', 'b']);
  });
});
