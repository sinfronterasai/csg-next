import crypto from 'node:crypto';
import { query, transaction } from '@/lib/db';
import { CSG_REPLY_TO, CSG_SENDER, requireResend, resendConfig } from './resend';

export type MarketingSource = 'account_signup' | 'newsletter_form' | 'tarot_quiz';
export type Language = 'en' | 'es';
export type SequenceKey = 'general_welcome' | 'tarot_welcome';

const CONSENT_COPY_VERSION = '2026-10-10.v1';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cosmicspiritguide.com';

export function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeLanguage(value: unknown): Language {
  return value === 'es' ? 'es' : 'en';
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signToken(payload: Record<string, unknown>): string {
  const secret = process.env.RESEND_CONFIRMATION_SECRET || process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readToken(token: string): Record<string, unknown> | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const secret = process.env.RESEND_CONFIRMATION_SECRET || process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
    const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function confirmationToken(email: string, source: MarketingSource): string {
  return signToken({ kind: 'confirm', email, source, exp: Date.now() + 48 * 60 * 60 * 1000 });
}

export function unsubscribeToken(email: string): string {
  return signToken({ kind: 'unsubscribe', email, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 });
}

export function parseMarketingToken(token: string, kind: 'confirm' | 'unsubscribe') {
  const payload = readToken(token);
  if (!payload || payload.kind !== kind || typeof payload.email !== 'string') return null;
  return payload;
}

function sourceSegment(source: MarketingSource) {
  const config = resendConfig();
  return source === 'tarot_quiz' ? config.tarotSegmentId : config.newsletterSegmentId;
}

function sourceTopic(source: MarketingSource) {
  const config = resendConfig();
  return source === 'tarot_quiz' ? config.tarotTopicId : config.newsletterTopicId;
}

export async function recordExplicitOptIn(input: {
  email: string;
  source: MarketingSource;
  language?: unknown;
  userId?: number | null;
  archetype?: string | null;
  resultUrl?: string | null;
  requireConfirmation?: boolean;
  idempotencyKey?: string;
}) {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) throw new Error('A valid email address is required');
  const language = safeLanguage(input.language);
  const requireConfirmation = Boolean(input.requireConfirmation);
  const idempotencyKey = input.idempotencyKey || hash(`${email}:${input.source}:${CONSENT_COPY_VERSION}:${Date.now()}`);
  const status = requireConfirmation ? 'pending_confirmation' : 'active';
  const properties = {
    language,
    signup_source: input.source,
    ...(input.archetype ? { archetype: input.archetype } : {}),
    ...(input.resultUrl ? { result_url: input.resultUrl } : {}),
  };

  const row = await transaction(async (tx) => {
    const existing = await tx('SELECT * FROM csg_email_subscriptions WHERE email = $1 FOR UPDATE', [email]);
    const current = existing.rows[0];
    if (!current) {
      const inserted = await tx(
        `INSERT INTO csg_email_subscriptions (email,user_id,status,language,signup_source,consent_copy_version,consent_at,properties)
         VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $3 = 'active' THEN now() ELSE NULL END,$7)
         RETURNING *`,
        [email, input.userId ?? null, status, language, input.source, CONSENT_COPY_VERSION, properties],
      );
      await tx(
        `INSERT INTO csg_email_consent_events (subscription_id,email,event_type,source,consent_copy_version,language,source_ref,idempotency_key)
         VALUES ($1,$2,'opt_in',$3,$4,$5,$6,$7) ON CONFLICT (idempotency_key) DO NOTHING`,
        [inserted.rows[0].id, email, input.source, CONSENT_COPY_VERSION, language, input.resultUrl || null, idempotencyKey],
      );
      return inserted.rows[0];
    }

    const nextStatus = current.status === 'suppressed' ? 'suppressed' : status;
    const updated = await tx(
      `UPDATE csg_email_subscriptions
       SET user_id = COALESCE($2,user_id), status = $3, language = $4, signup_source = $5,
           consent_copy_version = $6, consent_at = CASE WHEN $3 = 'active' THEN now() ELSE consent_at END,
           properties = properties || $7::jsonb, updated_at = now(), last_event_at = now()
       WHERE id = $1 RETURNING *`,
      [current.id, input.userId ?? null, nextStatus, language, input.source, CONSENT_COPY_VERSION, JSON.stringify(properties)],
    );
    await tx(
      `INSERT INTO csg_email_consent_events (subscription_id,email,event_type,source,consent_copy_version,language,source_ref,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (idempotency_key) DO NOTHING`,
      [current.id, email, current.status === 'unsubscribed' ? 'resubscribe' : 'opt_in', input.source, CONSENT_COPY_VERSION, language, input.resultUrl || null, idempotencyKey],
    );
    return updated.rows[0];
  });

  if (row.status === 'active') {
    await enqueueOutbox(row.id, 'sync_contact', {
      email, source: input.source, language, archetype: input.archetype || null, resultUrl: input.resultUrl || null,
    }, `sync:${email}:${idempotencyKey}`);
    if (input.source === 'tarot_quiz') await enrollSequence(row.id, 'tarot_welcome', input.source);
    else await enrollSequence(row.id, 'general_welcome', input.source);
  } else if (requireConfirmation) {
    const token = confirmationToken(email, input.source);
    const confirmUrl = `${BASE_URL}/api/marketing/confirm?token=${encodeURIComponent(token)}`;
    const subject = language === 'es' ? 'Confirma tu suscripción a Cosmic Spirit Guide' : 'Confirm your Cosmic Spirit Guide subscription';
    const text = language === 'es' ? `Confirma tu suscripción: ${confirmUrl}` : `Confirm your subscription: ${confirmUrl}`;
    const html = `<html lang="${language}"><body style="margin:0;background:#0d0a16;color:#eef0f6;font-family:Arial,Helvetica,sans-serif;padding:32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#151024;border:1px solid #4b0082;padding:32px;"><tr><td><p style="color:#dfb76c;letter-spacing:3px;">COSMIC SPIRIT GUIDE</p><h1 style="font-family:Georgia,serif;">${escapeHtml(subject)}</h1><p>${language === 'es' ? 'Haz clic para confirmar que deseas recibir estos mensajes.' : 'Click below to confirm that you want to receive these messages.'}</p><p><a href="${confirmUrl}" style="color:#fff;background:#7b3fd4;padding:13px 22px;border-radius:999px;text-decoration:none;">${language === 'es' ? 'Confirmar suscripción' : 'Confirm subscription'}</a></p></td></tr></table></td></tr></table></body></html>`;
    await enqueueOutbox(row.id, 'send_confirmation', { to: email, subject, html, text, idempotencyKey: `confirm-email:${email}:${idempotencyKey}` }, `confirm:${email}:${idempotencyKey}`);
  }
  return row;
}

async function enqueueOutbox(subscriptionId: number, operation: string, payload: unknown, idempotencyKey: string) {
  await query(
    `INSERT INTO csg_email_outbox (subscription_id,operation,idempotency_key,payload)
     VALUES ($1,$2,$3,$4) ON CONFLICT (idempotency_key) DO NOTHING`,
    [subscriptionId, operation, idempotencyKey, JSON.stringify(payload)],
  );
}

async function enrollSequence(subscriptionId: number, sequenceKey: SequenceKey, source: MarketingSource) {
  const inserted = await query(
    `INSERT INTO csg_email_sequence_enrollments (subscription_id,sequence_key,source)
     VALUES ($1,$2,$3) ON CONFLICT (subscription_id,sequence_key) DO NOTHING RETURNING id`,
    [subscriptionId, sequenceKey, source],
  );
  if (!inserted.rows[0]) return;
  const steps = sequenceKey === 'tarot_welcome'
    ? [['immediate', 0], ['day_2', 2], ['day_5', 5]]
    : [['immediate', 0], ['day_2', 2], ['day_5', 5]];
  for (const [stepKey, days] of steps) {
    await query(
      `INSERT INTO csg_email_sequence_steps (enrollment_id,step_key,scheduled_at,idempotency_key)
       VALUES ($1,$2,now() + ($3 || ' days')::interval,$4) ON CONFLICT DO NOTHING`,
      [inserted.rows[0].id, stepKey, days, `sequence:${inserted.rows[0].id}:${stepKey}`],
    );
  }
}

export async function confirmOptIn(token: string) {
  const payload = parseMarketingToken(token, 'confirm');
  if (!payload || typeof payload.source !== 'string' || !['newsletter_form', 'tarot_quiz'].includes(payload.source)) throw new Error('Invalid confirmation token');
  const email = normalizeEmail(payload.email);
  const result = await transaction(async (tx) => {
    const subscription = await tx('SELECT * FROM csg_email_subscriptions WHERE email = $1 FOR UPDATE', [email]);
    if (!subscription.rows[0]) throw new Error('Subscription not found');
    const row = await tx(`UPDATE csg_email_subscriptions SET status='active', confirmed_at=now(), consent_at=COALESCE(consent_at, now()), updated_at=now(), last_event_at=now() WHERE id=$1 RETURNING *`, [subscription.rows[0].id]);
    await tx(`INSERT INTO csg_email_consent_events (subscription_id,email,event_type,source,consent_copy_version,language,idempotency_key) VALUES ($1,$2,'confirmation',$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [row.rows[0].id, email, payload.source, CONSENT_COPY_VERSION, row.rows[0].language, `confirm:${email}:${payload.exp}`]);
    return row.rows[0];
  });
  await enqueueOutbox(result.id, 'sync_contact', { email, source: payload.source, language: result.language, archetype: result.properties?.archetype || null, resultUrl: result.properties?.result_url || null }, `sync-confirm:${email}:${payload.exp}`);
  await enrollSequence(result.id, payload.source === 'tarot_quiz' ? 'tarot_welcome' : 'general_welcome', payload.source as MarketingSource);
  await processEmailOutbox(5);
}

export async function unsubscribeEmail(token: string) {
  const payload = parseMarketingToken(token, 'unsubscribe');
  if (!payload) throw new Error('Invalid unsubscribe token');
  const email = normalizeEmail(payload.email);
  const { rows } = await query(`UPDATE csg_email_subscriptions SET status='unsubscribed', unsubscribed_at=now(), updated_at=now(), last_event_at=now() WHERE email=$1 RETURNING *`, [email]);
  if (!rows[0]) return;
  await query(`INSERT INTO csg_email_consent_events (subscription_id,email,event_type,source,idempotency_key) VALUES ($1,$2,'unsubscribe','resend_preference',$3) ON CONFLICT DO NOTHING`, [rows[0].id, email, `unsubscribe:${email}:${payload.exp}`]);
  await query(`UPDATE csg_email_sequence_steps SET status='cancelled' WHERE enrollment_id IN (SELECT id FROM csg_email_sequence_enrollments WHERE subscription_id=$1) AND status='pending'`, [rows[0].id]);
  await query(`UPDATE csg_email_outbox SET status='cancelled', updated_at=now() WHERE subscription_id=$1 AND status IN ('pending','failed')`, [rows[0].id]);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function unsubscribeUrl(email: string) {
  return `${BASE_URL}/api/marketing/unsubscribe?token=${encodeURIComponent(unsubscribeToken(email))}`;
}

export function buildResultEmail(input: { archetype: string; resultUrl: string; language: Language }) {
  const title = input.language === 'es' ? 'Tu arquetipo del tarot' : 'Your tarot archetype';
  const intro = input.language === 'es' ? 'Aquí está tu resultado de Cosmic Spirit Guide.' : 'Here is your Cosmic Spirit Guide result.';
  const cta = input.language === 'es' ? 'Volver a tu resultado' : 'Return to your result';
  return {
    subject: input.language === 'es' ? `Tu arquetipo del tarot: ${input.archetype}` : `Your tarot archetype: ${input.archetype}`,
    html: `<html lang="${input.language}"><body style="margin:0;background:#0d0a16;color:#eef0f6;font-family:Arial,Helvetica,sans-serif;padding:32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#151024;border:1px solid #4b0082;padding:32px;"><tr><td><p style="color:#dfb76c;letter-spacing:3px;">COSMIC SPIRIT GUIDE</p><h1 style="font-family:Georgia,serif;">${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p><h2 style="color:#a98fe0;">${escapeHtml(input.archetype)}</h2><p><a href="${escapeHtml(input.resultUrl)}" style="color:#ffffff;background:#7b3fd4;padding:13px 22px;border-radius:999px;text-decoration:none;">${escapeHtml(cta)}</a></p></td></tr></table></td></tr></table></body></html>`,
    text: `${title}\n\n${intro}\n\n${input.archetype}\n\n${cta}: ${input.resultUrl}`,
  };
}

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string; text: string; idempotencyKey: string }) {
  const resend = requireResend();
  const result = await resend.emails.send({ from: CSG_SENDER, to: input.to, replyTo: CSG_REPLY_TO, subject: input.subject, html: input.html, text: input.text }, { idempotencyKey: input.idempotencyKey });
  if (result.error) throw new Error(result.error.message);
  return result.data?.id || null;
}

export async function syncContact(subscriptionId: number, payload: { email: string; source: MarketingSource; language: Language; archetype?: string | null; resultUrl?: string | null }) {
  const resend = requireResend();
  const config = resendConfig();
  const segmentId = sourceSegment(payload.source);
  const topicId = sourceTopic(payload.source);
  if (!segmentId || !topicId) throw new Error('Resend segment/topic IDs are not configured');
  const properties = { language: payload.language, signup_source: payload.source, ...(payload.archetype ? { archetype: payload.archetype } : {}), ...(payload.resultUrl ? { result_url: payload.resultUrl } : {}) };
  let contactId: string;
  const created = await resend.contacts.create({ email: payload.email, unsubscribed: false, properties, segments: [{ id: segmentId }], topics: [{ id: topicId, subscription: 'opt_in' }] });
  if (created.error) {
    const existing = await resend.contacts.get(payload.email);
    if (existing.error || !existing.data) throw new Error(created.error.message);
    contactId = existing.data.id;
    const updated = await resend.contacts.update({ email: payload.email, unsubscribed: false, properties });
    if (updated.error) throw new Error(updated.error.message);
    const segment = await resend.contacts.segments.add({ email: payload.email, segmentId });
    if (segment.error) throw new Error(segment.error.message);
    const topics = await resend.contacts.topics.update({ email: payload.email, topics: [{ id: topicId, subscription: 'opt_in' }] });
    if (topics.error) throw new Error(topics.error.message);
  } else {
    contactId = created.data?.id || '';
  }
  await query('UPDATE csg_email_subscriptions SET resend_contact_id=$2, updated_at=now() WHERE id=$1', [subscriptionId, contactId]);
  return contactId;
}

export async function processSequenceSteps(limit = 20) {
  const { rows } = await query(
    `SELECT s.id, s.enrollment_id, s.idempotency_key, s.status AS step_status, e.sequence_key, e.status AS enrollment_status, sub.email, sub.language, sub.status, sub.properties
     FROM csg_email_sequence_steps s
     JOIN csg_email_sequence_enrollments e ON e.id=s.enrollment_id
     JOIN csg_email_subscriptions sub ON sub.id=e.subscription_id
     WHERE s.status='pending' AND s.scheduled_at <= now() AND e.status IN ('pending','active')
     ORDER BY s.id LIMIT $1`,
    [limit],
  );
  let processed = 0;
  const cardUrls: Record<string, string> = { seeker: 'the-fool', creator: 'the-magician', intuitive: 'the-high-priestess', nurturer: 'the-empress', builder: 'the-emperor', connector: 'the-lovers', pathfinder: 'the-chariot', reflector: 'the-hermit' };
  for (const step of rows) {
    if (step.step_status !== 'pending' || step.enrollment_status === 'cancelled' || step.status !== 'active') {
      await query(`UPDATE csg_email_sequence_steps SET status='cancelled' WHERE id=$1`, [step.id]);
      continue;
    }
    const language = step.language === 'es' ? 'es' : 'en';
    const archetype = step.properties?.archetype || 'The Seeker';
    const slug = cardUrls[String(step.properties?.archetype || 'seeker')] || 'the-fool';
    const unsubscribe = unsubscribeUrl(step.email);
    const isTarot = step.sequence_key === 'tarot_welcome';
    const content = isTarot
      ? step.step_key === 'immediate'
        ? { subject: `Your tarot archetype: ${archetype}`, body: `Your archetype result is ready. Return to it whenever you want a focused reflection.`, cta: 'View your archetype', url: step.properties?.result_url || `${BASE_URL}/quizzes/tarot-archetype` }
        : step.step_key === 'day_2'
          ? { subject: `A reflection on ${archetype}`, body: `The tarot card associated with your archetype can offer a useful lens for noticing patterns, choices, and next steps.`, cta: 'Explore the card meaning', url: `${BASE_URL}/tarot/${slug}` }
          : { subject: 'A tarot reading for your next question', body: 'Bring one honest question and use a free tarot reading as a reflection prompt.', cta: 'Try a free tarot reading', url: `${BASE_URL}/tarot` }
      : step.step_key === 'immediate'
        ? { subject: 'Welcome to Cosmic Spirit Guide', body: 'You’ll receive weekly astrology and tarot insights, practical reflections, and occasional offers.', cta: 'Explore your free birth chart', url: `${BASE_URL}/birth-chart` }
        : step.step_key === 'day_2'
          ? { subject: 'A simple way to read your big three', body: 'Sun speaks to identity, Moon to emotional patterns, and Rising to how you meet the world. Together they make a richer starting point.', cta: 'Generate your free chart', url: `${BASE_URL}/birth-chart` }
          : { subject: 'A free tarot reflection for your week', body: 'Bring one honest question and stay curious about what a free tarot reading surfaces.', cta: 'Try a free tarot reading', url: `${BASE_URL}/tarot` };
    const html = `<html lang="${language}"><body style="margin:0;background:#0d0a16;color:#eef0f6;font-family:Arial,Helvetica,sans-serif;padding:32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#151024;border:1px solid #4b0082;padding:32px;"><tr><td><p style="color:#dfb76c;letter-spacing:3px;">COSMIC SPIRIT GUIDE</p><h1 style="font-family:Georgia,serif;">${escapeHtml(content.subject)}</h1><p>${escapeHtml(content.body)}</p><p><a href="${escapeHtml(String(content.url))}" style="color:#fff;background:#7b3fd4;padding:13px 22px;border-radius:999px;text-decoration:none;">${escapeHtml(content.cta)}</a></p><p style="font-size:12px;color:#8b8fa0;">Manage preferences or unsubscribe: <a href="${unsubscribe}" style="color:#a98fe0;">unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>`;
    const text = `${content.subject}\n\n${content.body}\n\n${content.cta}: ${content.url}\n\nUnsubscribe: ${unsubscribe}`;
    try {
      await sendTransactionalEmail({ to: step.email, subject: content.subject, html, text, idempotencyKey: step.idempotency_key });
      await query(`UPDATE csg_email_sequence_steps SET status='sent', sent_at=now() WHERE id=$1`, [step.id]);
      await query(`UPDATE csg_email_sequence_enrollments SET status='active' WHERE id=$1`, [step.enrollment_id]);
      processed++;
    } catch (error) {
      await query(`UPDATE csg_email_sequence_steps SET status='failed', scheduled_at=now() + interval '15 minutes' WHERE id=$1`, [step.id]);
      console.error('[marketing/sequence] deferred:', error instanceof Error ? error.message : 'unknown error');
    }
  }
  return processed;
}

export async function processEmailOutbox(limit = 20) {
  const { rows } = await query(
    `SELECT * FROM csg_email_outbox WHERE status IN ('pending','failed') AND next_attempt_at <= now() ORDER BY id LIMIT $1`,
    [limit],
  );
  let processed = 0;
  for (const item of rows) {
    await query(`UPDATE csg_email_outbox SET status='processing', attempts=attempts+1, updated_at=now() WHERE id=$1`, [item.id]);
    try {
      let providerId: string | null = null;
      if (item.operation === 'sync_contact') providerId = await syncContact(item.subscription_id, item.payload);
      else if (item.operation === 'send_result' || item.operation === 'send_confirmation') providerId = await sendTransactionalEmail(item.payload);
      await query(`UPDATE csg_email_outbox SET status='succeeded', provider_id=$2, updated_at=now() WHERE id=$1`, [item.id, providerId]);
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Resend error';
      await query(`UPDATE csg_email_outbox SET status='failed', last_error=$2, next_attempt_at=now() + interval '15 minutes', updated_at=now() WHERE id=$1`, [item.id, message.slice(0, 1000)]);
    }
  }
  return processed;
}

export { CONSENT_COPY_VERSION };
