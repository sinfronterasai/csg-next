import { computePatterns } from '@/lib/profile/patterns';
import type { UniversalReadingRecord } from '@/lib/profile/store';

function recs(n: number): UniversalReadingRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i, userId: 1, type: 'tarot' as const, title: null, question: 'q', category: 'career',
    scope: null, periodStart: null, periodEnd: null, pricePaid: null, partnerLabel: null,
    result: { cards: [{ name: 'The Star', reversed: false }] }, reflection: null,
    createdAt: `2026-08-0${i + 1}T10:00:00Z`,
  }));
}

describe('patterns opt-out + false-insight guards', () => {
  it('opt-out returns eligible:false and empty aggregates (not exposed)', () => {
    const p = computePatterns(recs(5), { patternsOptIn: false });
    expect(p.eligible).toBe(false);
    expect(p.totalReadings).toBe(0);
    expect(p.reflectionPrompts).toEqual({});
    expect(p.recurringCards).toEqual([]);
  });

  it('opt-in with >=3 readings returns aggregates', () => {
    const p = computePatterns(recs(5), { patternsOptIn: true });
    expect(p.eligible).toBe(true);
    expect(p.totalReadings).toBe(5);
    expect(p.recurringCards.length).toBeGreaterThan(0);
  });

  it('whole-word motif matching does not fire on substrings (interest ≠ rest)', () => {
    const withInterest: UniversalReadingRecord = {
      ...recs(1)[0], type: 'report', result: { text: 'You show genuine interest in restful hobbies and rest often.' },
    };
    const p = computePatterns([withInterest], { patternsOptIn: true });
    const rest = p.reportMotifs.find((m) => m.motif === 'rest');
    // "interest" must NOT inflate "rest"; only a standalone "rest" word counts the one real occurrence.
    expect(rest?.count).toBe(1);
  });
});
