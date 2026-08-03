import {
  TIER_RANK,
  spreadTierMet,
  buildEntitlement,
  type Tier,
} from '@/lib/tarot/entitlements';
import { spreads } from '@/lib/tarot/spreads';

describe('entitlement tier math (pure)', () => {
  it('ranks tiers free < premium < premium_plus', () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.premium);
    expect(TIER_RANK.premium).toBeLessThan(TIER_RANK.premium_plus);
  });

  it('free user meets free spreads only', () => {
    expect(spreadTierMet('free', 'free')).toBe(true);
    expect(spreadTierMet('premium', 'free')).toBe(false);
    expect(spreadTierMet('premium_plus', 'free')).toBe(false);
  });

  it('premium user meets free and premium, not premium_plus', () => {
    expect(spreadTierMet('free', 'premium')).toBe(true);
    expect(spreadTierMet('premium', 'premium')).toBe(true);
    expect(spreadTierMet('premium_plus', 'premium')).toBe(false);
  });

  it('premium_plus meets all tiers', () => {
    expect(spreadTierMet('free', 'premium_plus')).toBe(true);
    expect(spreadTierMet('premium', 'premium_plus')).toBe(true);
    expect(spreadTierMet('premium_plus', 'premium_plus')).toBe(true);
  });
});

describe('buildEntitlement (per-user view over all spreads)', () => {
  it('anonymous (no tier) -> only free spreads allowed', () => {
    const e = buildEntitlement(null);
    const allowed = spreads.filter((s) => e.allowed[s.id]);
    const freeIds = spreads.filter((s) => s.tier === 'free').map((s) => s.id);
    expect(allowed.map((s) => s.id).sort()).toEqual([...freeIds].sort());
    expect(e.isSubscribed).toBe(false);
    expect(e.tier).toBe('free');
  });

  it('premium tier -> free + premium allowed, premium_plus denied with requiredTier', () => {
    const e = buildEntitlement('premium' as Tier);
    expect(e.allowed['one_card']).toBe(true);
    expect(e.allowed['past_present_future']).toBe(true);
    expect(e.allowed['celtic_cross']).toBe(true);
    expect(e.allowed['relationship_dynamics']).toBe(true);
    expect(e.allowed['career_crossroads']).toBe(true);
    // No premium_plus spread in MVP set, but the helper must still flag a hypothetical one.
    expect(e.isSubscribed).toBe(true);
    expect(e.tier).toBe('premium');
  });

  it('unknown tier string defaults to free (fail-safe, never over-grants)', () => {
    const e = buildEntitlement('garbage' as Tier);
    expect(e.tier).toBe('free');
    const allowed = spreads.filter((s) => e.allowed[s.id]).map((s) => s.id);
    const freeIds = spreads.filter((s) => s.tier === 'free').map((s) => s.id);
    expect(allowed.sort()).toEqual([...freeIds].sort());
  });
});
