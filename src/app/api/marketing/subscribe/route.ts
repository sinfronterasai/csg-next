import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildResultEmail, normalizeEmail, processEmailOutbox, recordExplicitOptIn, validEmail } from '@/lib/email/subscriptions';

const ARCHETYPES: Record<string, string> = {
  seeker: 'The Seeker', creator: 'The Creator', intuitive: 'The Intuitive', nurturer: 'The Nurturer',
  builder: 'The Builder', connector: 'The Connector', pathfinder: 'The Pathfinder', reflector: 'The Reflector',
};


function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const body = await request.json();
    if (body.sendResult !== true && body.sendResult !== false) return NextResponse.json({ error: 'sendResult must be explicitly true or false' }, { status: 400 });
    if (body.marketingOptIn !== true && body.marketingOptIn !== false) return NextResponse.json({ error: 'marketingOptIn must be explicitly true or false' }, { status: 400 });
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    const prior = await query(`SELECT updated_at FROM csg_campaign_subscribers WHERE email=$1`, [email]);
    if (prior.rows[0]?.updated_at && Date.now() - new Date(prior.rows[0].updated_at).getTime() < 60_000) {
      return NextResponse.json({ error: 'Please wait before submitting another request' }, { status: 429 });
    }

    if (typeof body.contentId === 'string' || typeof body.archetype === 'string') {
      await query(
        `INSERT INTO csg_campaign_subscribers
          (email, send_result, marketing_opt_in, consent_source, archetype, content_id, utm_source, utm_campaign, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT (email) DO UPDATE SET
           send_result = csg_campaign_subscribers.send_result OR EXCLUDED.send_result,
           marketing_opt_in = csg_campaign_subscribers.marketing_opt_in OR EXCLUDED.marketing_opt_in,
           consent_source = EXCLUDED.consent_source,
           archetype = COALESCE(EXCLUDED.archetype, csg_campaign_subscribers.archetype),
           content_id = COALESCE(EXCLUDED.content_id, csg_campaign_subscribers.content_id),
           utm_source = COALESCE(EXCLUDED.utm_source, csg_campaign_subscribers.utm_source),
           utm_campaign = COALESCE(EXCLUDED.utm_campaign, csg_campaign_subscribers.utm_campaign),
           updated_at = now()` ,
        [email, body.sendResult === true, body.marketingOptIn === true, body.marketingOptIn === true ? 'tarot_quiz' : 'result_request', body.archetype || null, body.contentId || null, body.utmSource || null, body.utmCampaign || null],
      );
    }

    const source = body.source === 'tarot_quiz' ? 'tarot_quiz' : 'newsletter_form';
    const language = body.language === 'es' ? 'es' : 'en';

    if (source === 'newsletter_form') {
      await recordExplicitOptIn({ email, source, language, requireConfirmation: true, idempotencyKey: request.headers.get('idempotency-key') || undefined });
      await processEmailOutbox(5);
      return NextResponse.json({ ok: true, message: 'Check your email to confirm your subscription.' });
    }

    const archetypeKey = typeof body.archetype === 'string' ? body.archetype : '';
    const archetype = ARCHETYPES[archetypeKey];
    const resultUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cosmicspiritguide.com'}/quizzes/tarot-archetype`;
    if (!archetype) return NextResponse.json({ error: 'Invalid quiz result' }, { status: 400 });

    if (body.sendResult === true) {
      const resultEmail = buildResultEmail({ archetype, resultUrl, language });
      await query(
        `INSERT INTO csg_email_outbox (subscription_id,operation,idempotency_key,payload)
         VALUES (NULL,'send_result',$1,$2) ON CONFLICT (idempotency_key) DO NOTHING`,
        [`result:${email}:${archetypeKey}`, JSON.stringify({ to: email, ...resultEmail, idempotencyKey: `result:${email}:${archetypeKey}` })],
      );
    }

    if (body.marketingOptIn === true) {
      await recordExplicitOptIn({
        email, source, language, archetype, resultUrl, requireConfirmation: true,
        idempotencyKey: request.headers.get('idempotency-key') || undefined,
      });
    }
    await processEmailOutbox(5);
    return NextResponse.json({ ok: true, message: body.marketingOptIn === true ? 'Your requested email is on its way. Check your inbox to confirm follow-up subscriptions.' : 'Your requested email is on its way.' });
  } catch (error) {
    console.error('[marketing/subscribe] deferred:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ ok: true, message: 'Your request was received and will be processed shortly.' });
  }
}
