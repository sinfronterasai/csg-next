import { spreads, type Spread, type Tier } from '@/lib/tarot/spreads';
import { buildEntitlement, type Entitlement } from '@/lib/tarot/entitlements';

export interface SpreadWithAccess extends Spread {
  allowed: boolean;
}

export interface SpreadsListResponse {
  spreads: SpreadWithAccess[];
  entitlement: Entitlement;
}

/**
 * Build the GET /api/tarot/spreads payload: every spread annotated with
 * whether the caller may draw it, given their subscription tier (or null).
 */
export function buildSpreadsResponse(tier: Tier | null): SpreadsListResponse {
  const entitlement = buildEntitlement(tier);
  const annotated = spreads.map((s) => ({
    ...s,
    allowed: entitlement.allowed[s.id] ?? false,
  }));
  return { spreads: annotated, entitlement };
}
