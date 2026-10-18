import crypto from 'node:crypto';

export type CampaignAttribution = {
  contentId: string | null;
  source: string | null;
  campaign: string | null;
};

const ATTRIBUTION_COOKIE = 'csg_campaign_attribution';

export function readAttributionFromUrl(url: URL): CampaignAttribution {
  return {
    contentId: url.searchParams.get('utm_content'),
    source: url.searchParams.get('utm_source'),
    campaign: url.searchParams.get('utm_campaign'),
  };
}

export function unsubscribeToken(email: string): string {
  const secret = process.env.CAMPAIGN_UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('CAMPAIGN_UNSUBSCRIBE_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  try {
    const expected = unsubscribeToken(email);
    return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export { ATTRIBUTION_COOKIE };