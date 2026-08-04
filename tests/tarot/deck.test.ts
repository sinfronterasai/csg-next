import { deck, TarotCard } from '@/lib/tarot/deck';

describe('Tarot deck seed', () => {
  it('contains exactly 78 cards', () => {
    expect(deck.length).toBe(78);
  });

  it('every card has the required fields with non-empty values', () => {
    const required: (keyof TarotCard)[] = ['id', 'name', 'suit', 'upright', 'reversed', 'artRef'];
    for (const card of deck) {
      for (const key of required) {
        const val = card[key];
        expect(val).toBeDefined();
        if (typeof val === 'string') {
          expect(val.trim().length).toBeGreaterThan(0, `card.${key} empty for ${card.name}`);
        }
      }
    }
  });

  it('has 22 major arcana (ids 0-21) and 56 minor arcana', () => {
    const majors = deck.filter((c) => typeof c.id === 'number');
    const minors = deck.filter((c) => typeof c.id === 'string');
    expect(majors.length).toBe(22);
    expect(minors.length).toBe(56);
  });

  it('names are unique', () => {
    const names = new Set(deck.map((c) => c.name));
    expect(names.size).toBe(78);
  });

  it('major arcana ids are 0 through 21 contiguous', () => {
    const majorIds = deck
      .filter((c) => typeof c.id === 'number')
      .map((c) => c.id as number)
      .sort((a, b) => a - b);
    expect(majorIds).toEqual(Array.from({ length: 22 }, (_, i) => i));
  });
});
