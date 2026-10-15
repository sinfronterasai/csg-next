export type CampaignAttribution = { contentId: string | null; source: string | null; campaign: string | null };
const STORAGE_KEY = 'csg-campaign-attribution-v1';

export function campaignAttribution(): CampaignAttribution {
  if (typeof window === 'undefined') return { contentId: null, source: null, campaign: null };
  const params = new URLSearchParams(window.location.search);
  const current = {
    contentId: params.get('utm_content'),
    source: params.get('utm_source'),
    campaign: params.get('utm_campaign'),
  };
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    const next = {
      contentId: current.contentId || stored?.contentId || null,
      source: current.source || stored?.source || null,
      campaign: current.campaign || stored?.campaign || null,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return current;
  }
}

export function campaignEvent(name: string, params: Record<string, string | null | undefined> = {}) {
  if (typeof window === 'undefined') return;
  const data = { ...params, ...campaignAttribution() };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...data });
  window.gtag?.('event', name, data);
  void fetch('/api/marketing/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: name, ...data }),
    keepalive: true,
  }).catch(() => undefined);
}

declare global {
  interface Window { dataLayer?: Array<Record<string, unknown>>; gtag?: (...args: unknown[]) => void; }
}