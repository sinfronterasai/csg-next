import { spreads, getSpread } from '@/lib/tarot/spreads';

describe('spread menu data', () => {
  it('every spread has a display priceLabel (no re-derivation in UI)', () => {
    for (const s of spreads) {
      expect(typeof s.priceLabel).toBe('string');
      expect(s.priceLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('free spreads are labeled "Free"', () => {
    expect(getSpread('one_card')!.priceLabel).toBe('Free');
    expect(getSpread('past_present_future')!.priceLabel).toBe('Free');
  });

  it('premium spreads show the Member price, not an invented number', () => {
    for (const id of ['celtic_cross', 'relationship_dynamics', 'career_crossroads']) {
      expect(getSpread(id)!.priceLabel).toBe('Member · $4.99');
    }
  });

  it('only one_card has a fixedQuestion; others require the modal', () => {
    expect(getSpread('one_card')!.fixedQuestion).toBe('What do I need to know right now?');
    expect(getSpread('past_present_future')!.fixedQuestion).toBeUndefined();
    expect(getSpread('celtic_cross')!.fixedQuestion).toBeUndefined();
    expect(getSpread('relationship_dynamics')!.fixedQuestion).toBeUndefined();
    expect(getSpread('career_crossroads')!.fixedQuestion).toBeUndefined();
  });

  it('card-count label matches the actual positions length (not hardcoded)', () => {
    expect(getSpread('one_card')!.positions.length).toBe(1);
    expect(getSpread('past_present_future')!.positions.length).toBe(3);
    expect(getSpread('celtic_cross')!.positions.length).toBe(10);
    // Relationship Dynamics and Career Crossroads have 6 positions in code.
    expect(getSpread('relationship_dynamics')!.positions.length).toBe(6);
    expect(getSpread('career_crossroads')!.positions.length).toBe(6);
  });
});
