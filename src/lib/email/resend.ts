import { Resend } from 'resend';

let client: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export const CSG_SENDER = 'Cosmic Spirit Guide <hello@cosmicspiritguide.com>';
export const CSG_REPLY_TO = 'support@cosmicspiritguide.com';

export function resendConfig() {
  return {
    newsletterSegmentId: process.env.RESEND_NEWSLETTER_SEGMENT_ID || '',
    tarotSegmentId: process.env.RESEND_TAROT_SEGMENT_ID || '',
    newsletterTopicId: process.env.RESEND_NEWSLETTER_TOPIC_ID || '',
    tarotTopicId: process.env.RESEND_TAROT_TOPIC_ID || '',
  };
}

export function requireResend() {
  const resend = getResend();
  if (!resend) throw new Error('RESEND_API_KEY is not configured');
  return resend;
}
