import { recommendSpread, type RecommendInput, type RecommendResult } from '@/lib/tarot/recommend';
import { getEntitlement } from '@/lib/tarot/entitlements';
import { getSpread } from '@/lib/tarot/spreads';

export type Recommendation = RecommendResult & { spreadName: string };

export interface RecommendApiResponse {
  recommendation: RecommendResult & { spreadName: string };
  tier: string;
}

/** Build the /api/tarot/recommend payload for a userId (or null for anonymous). */
export async function buildRecommendResponse(
  userId: number | string | null,
  input: RecommendInput,
): Promise<RecommendApiResponse> {
  let tier: RecommendInput['tier'] = null;
  if (userId != null) {
    try {
      const ent = await getEntitlement(userId);
      tier = ent.tier;
    } catch {
      tier = null;
    }
  }
  const rec = recommendSpread({ ...input, tier });
  const spread = getSpread(rec.spreadId);
  return {
    recommendation: { ...rec, spreadName: spread?.name ?? rec.spreadId },
    tier: tier ?? 'free',
  };
}
