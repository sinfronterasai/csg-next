import {
  computePatterns,
  computeRecurringCards,
  computeTimingClusters,
  TRANSIT_MARKERS,
} from '@/lib/profile/patterns';
import type { UniversalReadingRecord } from '@/lib/profile/store';

function reading(over: Partial<UniversalReadingRecord>): UniversalReadingRecord {
  return {
    id: Math.floor(Math.random() * 1e9),
    userId: 1,
    type: 'tarot',
    title: null,
    question: 'q',
    scope: null,
    periodStart: null,
    periodEnd: null,
    pricePaid: null,
    partnerLabel: null,
    result: {},
    reflection: null,
    createdAt: '2026-08-01T10:00:00Z',
    ...over,
  };
}

function tarot(cards: { name: string; reversed?: boolean }[], category: string, createdAt: string): UniversalReadingRecord {
  return reading({
    type: 'tarot',
    category,
    createdAt,
    result: { cards: cards.map((c) => ({ name: c.name, reversed: !!c.reversed })) },
  });
}

describe('computePatterns eligibility gate', () => {
  it('is not eligible with fewer than 3 readings', () => {
    const r = computePatterns([tarot([{ name: 'The Sun' }], 'love', '2026-08-01T10:00:00Z')], {});
    expect(r.eligible).toBe(false);
    expect(r.totalReadings).toBe(1);
  });

  it('is not eligible when user opted out', () => {
    const many = Array.from({ length: 3 }, (_, i) => tarot([{ name: 'The Sun' }], 'love', `2026-08-0${i + 1}T10:00:00Z`));
    const r = computePatterns(many, { patternsOptIn: false });
    expect(r.eligible).toBe(false);
  });

  it('is eligible with >=3 readings and opt-in', () => {
    const many = Array.from({ length: 3 }, (_, i) => tarot([{ name: 'The Sun' }], 'love', `2026-08-0${i + 1}T10:00:00Z`));
    const r = computePatterns(many, { patternsOptIn: true });
    expect(r.eligible).toBe(true);
  });
});

describe('recurring tarot cards', () => {
  it('surfaces cards drawn 2+ times with date range and categories', () => {
    const recs = [
      tarot([{ name: 'The Tower' }], 'career', '2026-01-05T10:00:00Z'),
      tarot([{ name: 'The Tower' }, { name: 'The Star' }], 'career', '2026-03-05T10:00:00Z'),
      tarot([{ name: 'The Tower', reversed: true }], 'career', '2026-08-10T10:00:00Z'),
    ];
    const cards = computeRecurringCards(recs);
    const tower = cards.find((c) => c.card === 'The Tower');
    expect(tower).toBeDefined();
    expect(tower!.count).toBe(3);
    expect(tower!.reversedCount).toBe(1);
    expect(tower!.firstSeen).toBe('2026-01-05T10:00:00Z');
    expect(tower!.lastSeen).toBe('2026-08-10T10:00:00Z');
    expect(tower!.categories).toEqual(['career']);
    // single-draw card suppressed
    expect(cards.find((c) => c.card === 'The Star')).toBeUndefined();
  });

  it('returns a reflective prompt for known cards', () => {
    const r = computePatterns([], {});
    expect(r.reflectionPromptFor('The Tower')).toMatch(/Tower/);
    expect(r.reflectionPromptFor('Unknown Card')).toBeNull();
  });
});

describe('sign resonance + element balance', () => {
  it('counts saved horoscope_sign plus horoscope saves', () => {
    const recs = [
      reading({ type: 'horoscope', title: 'Leo daily', question: 'Leo · daily', createdAt: '2026-08-01T10:00:00Z' }),
      reading({ type: 'horoscope', title: 'Leo weekly', question: 'Leo · weekly', createdAt: '2026-08-02T10:00:00Z' }),
    ];
    const r = computePatterns(recs.concat([tarot([{ name: 'The Sun' }], 'general', '2026-08-03T10:00:00Z')]), { horoscopeSign: 'Leo' });
    // patterns not eligible (<3 readings), but the sub-computations still run
    expect(r.signResonance.find((s) => s.sign === 'Leo')!.appearances).toBe(3);
    expect(r.elementBalance.Fire).toBe(1); // elementBalance counts distinct signs, not appearances
  });
});

describe('timing clusters vs transit markers', () => {
  it('clusters readings that fall inside a marker window', () => {
    const recs = [
      tarot([{ name: 'The Sun' }], 'general', '2026-08-24T10:00:00Z'), // Mercury Retro late Aug
      tarot([{ name: 'The Moon' }], 'general', '2026-08-25T10:00:00Z'),
    ];
    const clusters = computeTimingClusters(recs);
    const retro = clusters.find((c) => c.detail === 'Mercury Retrograde');
    expect(retro).toBeDefined();
    expect(retro!.count).toBe(2);
  });

  it('ships a non-empty hardcoded transit marker set', () => {
    expect(TRANSIT_MARKERS.length).toBeGreaterThan(0);
  });
});

describe('report motifs', () => {
  it('tallies recurring guidance language across report texts', () => {
    const recs = [
      reading({ type: 'report', title: 'Yearly Transit', result: { text: 'Set a boundary. Your boundary matters. Rest now.' }, createdAt: '2026-08-01T10:00:00Z' }),
      reading({ type: 'report', title: 'Vocation', result: { text: 'A boundary and rest.' }, createdAt: '2026-08-02T10:00:00Z' }),
    ];
    const r = computePatterns(recs, {});
    const boundary = r.reportMotifs.find((m) => m.motif === 'boundary');
    expect(boundary).toBeDefined();
    expect(boundary!.count).toBeGreaterThanOrEqual(1);
  });
});
