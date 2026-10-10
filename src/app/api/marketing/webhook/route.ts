import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getResend } from '@/lib/email/resend';

export const runtime = 'nodejs';

function findEmail(payload: any): string | null {
  const value = payload?.data?.email || payload?.data?.contact?.email || payload?.data?.to?.[0] || payload?.data?.recipient;
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const resend = getResend();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!resend || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  try {
    const event = resend.webhooks.verify({
      payload: raw,
      webhookSecret: secret,
      headers: {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || '',
      },
    }) as any;
    const eventId = request.headers.get('svix-id') || event?.id || '';
    if (!eventId) return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    const inserted = await query(
      `INSERT INTO csg_email_webhook_events (provider_event_id,event_type,payload) VALUES ($1,$2,$3) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`,
      [eventId, event.type || 'unknown', event],
    );
    if (!inserted.rows[0]) return NextResponse.json({ ok: true, duplicate: true });

    const email = findEmail(event);
    if (email) {
      const eventType = String(event.type || '');
      const consentEvent = eventType.includes('complained') ? 'complaint' : eventType.includes('bounced') || eventType.includes('suppressed') ? 'hard_bounce' : eventType.includes('failed') || eventType.includes('delivery_delayed') ? 'delivery_failure' : null;
      if (consentEvent) {
        const { rows } = await query('SELECT id FROM csg_email_subscriptions WHERE email=$1', [email]);
        if (rows[0]) {
          const status = consentEvent === 'hard_bounce' || consentEvent === 'complaint' ? 'suppressed' : undefined;
          if (status) await query(`UPDATE csg_email_subscriptions SET status='suppressed', updated_at=now(), last_event_at=now() WHERE id=$1`, [rows[0].id]);
          await query(`INSERT INTO csg_email_consent_events (subscription_id,email,event_type,source,metadata,idempotency_key) VALUES ($1,$2,$3,'resend_webhook',$4,$5) ON CONFLICT DO NOTHING`, [rows[0].id, email, consentEvent, event, `resend:${eventId}`]);
          if (status) await query(`UPDATE csg_email_sequence_steps SET status='cancelled' WHERE enrollment_id IN (SELECT id FROM csg_email_sequence_enrollments WHERE subscription_id=$1) AND status='pending'`, [rows[0].id]);
        }
      }
      if (eventType === 'contact.topics.updated') {
        const topics = Array.isArray(event.data?.topics) ? event.data.topics : [];
        if (topics.length && topics.every((topic: any) => topic.subscription === 'opt_out')) {
          const { rows } = await query('SELECT id FROM csg_email_subscriptions WHERE email=$1', [email]);
          if (rows[0]) await query(`UPDATE csg_email_subscriptions SET status='unsubscribed', unsubscribed_at=now(), updated_at=now(), last_event_at=now() WHERE id=$1`, [rows[0].id]);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[marketing/webhook] verification or processing failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }
}
