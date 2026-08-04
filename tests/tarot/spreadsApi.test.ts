import { buildSpreadsResponse } from '@/lib/tarot/spreadsApi';
import type { Tier } from '@/lib/tarot/spreads';

describe('GET /api/tarot/spreads payload', () => {
  it('anonymous call returns free spreads allowed, premium denied, and fail-safe tier=free', () => {
    const res = buildSpreadsResponse(null);
    expect(res.entitlement.tier).toBe('free');
    expect(res.entitlement.isSubscribed).toBe(false);
    const one = res.spreads.find((s) => s.id === 'one_card')!;
    const cc = res.spreads.find((s) => s.id === 'celtic_cross')!;
    expect(one.allowed).toBe(true);
    expect(cc.allowed).toBe(false);
    // every spread carries the required shape
    for (const s of res.spreads) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(Array.isArray(s.positions)).toBe(true);
      expect(typeof s.allowed).toBe('boolean');
      expect(['free', 'premium', 'premium_plus']).toContain(s.tier);
    }
  });

  it('premium call unlocks the three MVP premium spreads but keeps premium_plus off', () => {
    const res = buildSpreadsResponse('premium' as Tier);
    const byId = Object.fromEntries(res.spreads.map((s) => [s.id, s.allowed]));
    expect(byId['one_card']).toBe(true);
    expect(byId['past_present_future']).toBe(true);
    expect(byId['celtic_cross']).toBe(true);
    expect(byId['relationship_dynamics']).toBe(true);
    expect(byId['career_crossroads']).toBe(true);
    expect(res.entitlement.isSubscribed).toBe(true);
  });

  it('returns all 5 MVP spreads exactly once', () => {
    const res = buildSpreadsResponse(null);
    expect(res.spreads.map((s) => s.id).sort()).toEqual(
      ['career_crossroads', 'celtic_cross', 'one_card', 'past_present_future', 'relationship_dynamics'].sort(),
    );
  });
});
