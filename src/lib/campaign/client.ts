export type CampaignAttribution = { contentId: string | null; source: string | null; campaign: string | null };
const STORAGE_KEY = 'csg-campaign-attribution-v1';
const ALLOWED_EVENTS = new Set(['quiz_view', 'quiz_start', 'quiz_complete', 'result_share', 'result_download', 'free_reading_click', 'offer_click', 'purchase', 'email_request', 'consent_granted']);

function safeParam(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.includes('@')) return null;
  return text.slice(0, max);
}

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

export function campaignEvent(name: string, params: Record<string, string | null | undefined> = {}, serverParams: Record<string, string | null | undefined> = {}) {
  if (typeof window === 'undefined') return;
  if (!ALLOWED_EVENTS.has(name)) return;
  const cleanParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, safeParam(value)]));
  const attribution = campaignAttribution();
  const data = {
    ...cleanParams,
    contentId: safeParam(attribution.contentId),
    source: safeParam(attribution.source),
    campaign: safeParam(attribution.campaign),
  };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...data });
  window.gtag?.('event', name, data);
  void fetch('/api/marketing/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: name, ...data, ...serverParams }),
    keepalive: true,
  }).catch(() => undefined);
}

declare global {
  interface Window { dataLayer?: Array<Record<string, unknown>>; gtag?: (...args: unknown[]) => void; }
}