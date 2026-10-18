import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WINDOW_MS = 60 * 60_000;
const MAX_SUBSCRIPTIONS_PER_WINDOW = 10;
const requestLog = new Map<string, number[]>();

function allowedRequest(request: Request): boolean {
  const key = request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_SUBSCRIPTIONS_PER_WINDOW) return false;
  recent.push(now);
  requestLog.set(key, recent);
  return true;
}

function safeAttribution(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.includes('@')) return null;
  return text.slice(0, max);
}

export async function POST(request: Request) {
  try {
    if (!allowedRequest(request)) return NextResponse.json({ error: 'Too many subscription requests' }, { status: 429 });
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (body.sendResult !== true && body.sendResult !== false) {
      return NextResponse.json({ error: 'sendResult must be explicitly true or false' }, { status: 400 });
    }
    const sendResult = body.sendResult;
    const marketingOptIn = body.marketingOptIn === true;
    if (!EMAIL.test(email)) return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    if (body.marketingOptIn !== true && body.marketingOptIn !== false) {
      return NextResponse.json({ error: 'marketingOptIn must be explicitly true or false' }, { status: 400 });
    }

    const archetype = safeAttribution(body.archetype, 80);
    const contentId = safeAttribution(body.contentId, 120);
    const utmSource = safeAttribution(body.utmSource, 80);
    const utmCampaign = safeAttribution(body.utmCampaign, 120);
    await query(
      `INSERT INTO csg_campaign_subscribers
        (email, send_result, marketing_opt_in, consent_source, archetype, content_id, utm_source, utm_campaign, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (email) DO UPDATE SET
         send_result = EXCLUDED.send_result,
         marketing_opt_in = CASE WHEN EXCLUDED.consent_source = 'quiz' THEN EXCLUDED.marketing_opt_in ELSE csg_campaign_subscribers.marketing_opt_in END,
         consent_source = EXCLUDED.consent_source,
         archetype = COALESCE(EXCLUDED.archetype, csg_campaign_subscribers.archetype),
         content_id = COALESCE(EXCLUDED.content_id, csg_campaign_subscribers.content_id),
         utm_source = COALESCE(EXCLUDED.utm_source, csg_campaign_subscribers.utm_source),
         utm_campaign = COALESCE(EXCLUDED.utm_campaign, csg_campaign_subscribers.utm_campaign),
         unsubscribed_at = CASE WHEN EXCLUDED.consent_source = 'quiz' AND EXCLUDED.marketing_opt_in THEN NULL ELSE csg_campaign_subscribers.unsubscribed_at END,
         updated_at = now()` ,
      [email, sendResult, marketingOptIn, marketingOptIn ? 'quiz' : 'result_request', archetype, contentId, utmSource, utmCampaign],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[marketing/subscribe]', error);
    return NextResponse.json({ error: 'Unable to save subscription' }, { status: 500 });
  }
}