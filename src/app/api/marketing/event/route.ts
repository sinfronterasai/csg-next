import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ALLOWED_EVENTS = new Set([
  'quiz_view', 'quiz_start', 'quiz_complete', 'result_share', 'result_download',
  'free_reading_click', 'offer_click', 'purchase', 'email_request', 'consent_granted',
]);

function safeText(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventName = safeText(body.event, 80);
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) return NextResponse.json({ error: 'Unsupported campaign event' }, { status: 400 });

    const contentId = safeText(body.content_id || body.contentId);
    const archetype = safeText(body.archetype, 80);
    const params = {
      source: safeText(body.utm_source || body.source, 80),
      campaign: safeText(body.utm_campaign || body.campaign, 120),
      card: safeText(body.card, 120),
    };
    await query(
      `INSERT INTO csg_campaign_events (event_name, content_id, archetype, event_params)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [eventName, contentId, archetype, JSON.stringify(params)],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[marketing/event]', error);
    return NextResponse.json({ error: 'Unable to record campaign event' }, { status: 500 });
  }
}