import { spreads, getSpread } from '@/lib/tarot/spreads';

type Tier = 'free' | 'premium' | 'premium_plus';

describe('Tarot spreads (MVP set)', () => {
  const MVP_IDS = ['one_card', 'past_present_future', 'celtic_cross', 'relationship_dynamics', 'career_crossroads'];

  it('defines exactly the 5 MVP spreads', () => {
    expect(spreads.map((s) => s.id).sort()).toEqual([...MVP_IDS].sort());
  });

  it('every spread has id, name, tier, and a non-empty positions array', () => {
    for (const s of spreads) {
      expect(typeof s.id).toBe('string');
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(['free', 'premium', 'premium_plus']).toContain(s.tier as Tier);
      expect(Array.isArray(s.positions)).toBe(true);
      expect(s.positions.length).toBeGreaterThan(0);
      for (const pos of s.positions) {
        expect(pos.label.trim().length).toBeGreaterThan(0);
        expect(pos.meaning.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('free tier holds One Card and Past Present Future', () => {
    const free = spreads.filter((s) => s.tier === 'free').map((s) => s.id);
    expect(free).toEqual(expect.arrayContaining(['one_card', 'past_present_future']));
  });

  it('Celtic Cross is premium and has exactly 10 positions', () => {
    const cc = getSpread('celtic_cross');
    expect(cc).toBeDefined();
    expect(cc!.tier).toBe('premium');
    expect(cc!.positions.length).toBe(10);
  });

  it('Relationship Dynamics and Career Crossroads are premium', () => {
    expect(getSpread('relationship_dynamics')!.tier).toBe('premium');
    expect(getSpread('career_crossroads')!.tier).toBe('premium');
  });

  it('getSpread returns undefined for unknown id', () => {
    expect(getSpread('nope')).toBeUndefined();
  });
});
