import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ALLOWED_EVENTS = new Set([
  'quiz_view', 'quiz_start', 'quiz_complete', 'result_share', 'result_download',
  'free_reading_click', 'offer_click', 'purchase', 'email_request', 'consent_granted',
]);
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 60;
const requestLog = new Map<string, number[]>();

function allowedRequest(request: Request): boolean {
  const key = request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_EVENTS_PER_WINDOW) return false;
  recent.push(now);
  requestLog.set(key, recent);
  return true;
}

function safeText(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    if (!allowedRequest(request)) return NextResponse.json({ error: 'Too many campaign events' }, { status: 429 });
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