import { query } from '@/lib/db';
import { spreads, type Spread, type Tier } from '@/lib/tarot/spreads';

export { type Tier } from '@/lib/tarot/spreads';

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  premium: 1,
  premium_plus: 2,
};

/** True when a user at `userTier` may access a spread at `spreadTier`. */
export function spreadTierMet(spreadTier: Tier, userTier: Tier | null): boolean {
  const userRank = userTier ? TIER_RANK[userTier] : TIER_RANK.free;
  return userRank >= TIER_RANK[spreadTier];
}

export interface Entitlement {
  tier: Tier;
  isSubscribed: boolean;
  /** spreadId -> whether the current user may draw it */
  allowed: Record<string, boolean>;
}

/**
 * Build a per-user entitlement view over the known spreads.
 * `tier` is null for anonymous/unauthenticated users (fail-safe to free).
 */
export function buildEntitlement(tier: Tier | null): Entitlement {
  const safeTier: Tier = tier && TIER_RANK[tier] !== undefined ? tier : 'free';
  const allowed: Record<string, boolean> = {};
  for (const s of spreads) {
    allowed[s.id] = spreadTierMet(s.tier, safeTier);
  }
  return {
    tier: safeTier,
    isSubscribed: safeTier !== 'free',
    allowed,
  };
}

/** Resolve a user's effective tier from the users table (subscription_tier). */
export async function getEntitlement(userId: number | string): Promise<Entitlement> {
  try {
    const { rows } = await query(
      `SELECT subscription_tier FROM users WHERE id = $1`,
      [Number(userId)],
    );
    const raw = rows[0]?.subscription_tier;
    const tier: Tier | null =
      raw && TIER_RANK[raw as Tier] !== undefined ? (raw as Tier) : null;
    return buildEntitlement(tier);
  } catch {
    // DB unavailable -> fail-safe to free, never over-grant.
    return buildEntitlement(null);
  }
}
