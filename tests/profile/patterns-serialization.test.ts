import { computePatterns, REFLECTION_PROMPTS_MAP } from '@/lib/profile/patterns';
import type { UniversalReadingRecord } from '@/lib/profile/store';

function tarot(name: string, createdAt: string): UniversalReadingRecord {
  return {
    id: Math.floor(Math.random() * 1e9),
    userId: 1, type: 'tarot', title: null, question: 'q', category: 'career',
    scope: null, periodStart: null, periodEnd: null, pricePaid: null, partnerLabel: null,
    result: { cards: [{ name, reversed: false }] }, reflection: null, createdAt,
  };
}

describe('patterns serialization (no function-valued props)', () => {
  it('exposes reflectionPrompts as a data map, not a method', () => {
    const recs = Array.from({ length: 3 }, (_, i) =>
      tarot('The Tower', `2026-08-0${i + 1}T10:00:00Z`));
    const p = computePatterns(recs, { patternsOptIn: true });

    // The field must be a plain object, serializable by JSON.stringify.
    expect(typeof p.reflectionPrompts).toBe('object');
    expect(p.reflectionPrompts).not.toBeNull();
    // JSON.stringify must NOT drop it (this is what broke the client before).
    const roundTrip = JSON.parse(JSON.stringify(p));
    expect(typeof roundTrip.reflectionPrompts).toBe('object');
    expect(roundTrip.reflectionPrompts['The Tower']).toMatch(/Tower/);

    // There must be no function-valued reflectionPromptFor left on the result.
    expect((p as any).reflectionPromptFor).toBeUndefined();
    expect(typeof roundTrip.reflectionPromptFor).toBe('undefined');
  });

  it('REFLECTION_PROMPTS_MAP mirrors the prompts', () => {
    expect(REFLECTION_PROMPTS_MAP['The Tower']).toMatch(/Tower/);
  });
});
