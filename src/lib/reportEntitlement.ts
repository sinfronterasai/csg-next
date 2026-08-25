// Server-side report entitlement. The only durable, payment-backed signal of a
// user's plan is `users.subscription_tier` written by the verified Stripe
// webhook (src/lib/billing/stripe.ts). We NEVER trust any client-supplied flag.
import { query } from '@/lib/db';
import { TIER_RANK, type Tier } from '@/lib/tarot/entitlements';
import type { ReportType } from '@/lib/reportEngine';

// Maps each pipeline report to the subscription tier required to generate it.
// Prices come from REPORT_META; free reports need no subscription.
const REPORT_REQUIRED_TIER: Partial<Record<ReportType, Tier>> = {
  // paid (within the 3-tier subscription model)
  transit: 'premium',        // $39
  loveblueprint: 'premium',  // $39
  vocation: 'premium',       // $39
  karmicshadow: 'premium',   // $19
  lovetiming: 'premium',     // $29
  fullcosmic: 'premium_plus', // $89
};

export function requiredTierForReport(type: ReportType): Tier | null {
  // Free reports require no subscription.
  if (REPORT_REQUIRED_TIER[type] === undefined) return null;
  return REPORT_REQUIRED_TIER[type]!;
}

export function isPaidReport(type: ReportType): boolean {
  return requiredTierForReport(type) !== null;
}

/**
 * Authoritative entitlement check. Reads the user's persisted subscription tier
 * AND status from the database. Fails safe to "not entitled" on any error or
 * when the subscription is not active. Never inspects request bodies.
 */
export async function userEntitledForReport(
  userId: number | string,
  type: ReportType,
): Promise<{ entitled: boolean; requiredTier: Tier | null; reason: string }> {
  const requiredTier = requiredTierForReport(type);
  if (!requiredTier) {
    return { entitled: true, requiredTier: null, reason: 'free report' };
  }
  try {
    const { rows } = await query(
      `SELECT subscription_tier, subscription_status FROM users WHERE id = $1`,
      [Number(userId)],
    );
    const tier = rows[0]?.subscription_tier as Tier | undefined;
    const status = rows[0]?.subscription_status as string | undefined;
    if (status !== 'active') {
      return { entitled: false, requiredTier, reason: `subscription_status=${status ?? 'none'}` };
    }
    const userRank = tier && TIER_RANK[tier] !== undefined ? TIER_RANK[tier] : 0;
    const requiredRank = TIER_RANK[requiredTier];
    if (userRank >= requiredRank) {
      return { entitled: true, requiredTier, reason: `tier=${tier}` };
    }
    return { entitled: false, requiredTier, reason: `tier=${tier ?? 'none'} < ${requiredTier}` };
  } catch {
    // DB error -> fail safe, never over-grant.
    return { entitled: false, requiredTier, reason: 'entitlement lookup failed' };
  }
}
