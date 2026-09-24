import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TIMESTAMP_AGE_SECONDS = 300;

export function verifyWhopSignature(rawBody: string, headers: Headers, secret: string): void {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatureHeader = headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) throw new Error('Missing webhook headers');
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) throw new Error('Invalid webhook timestamp');
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_TIMESTAMP_AGE_SECONDS) throw new Error('Webhook timestamp too old');
  if (!secret) throw new Error('WHOP_WEBHOOK_SECRET is not configured');

  const expected = createHmac('sha256', secret).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
  const valid = signatureHeader.split(' ').map((part) => part.replace(/^v1,/, '')).filter(Boolean).some((candidate) => {
    const incoming = Buffer.from(candidate);
    const digest = Buffer.from(expected);
    return incoming.length === digest.length && timingSafeEqual(incoming, digest);
  });
  if (!valid) throw new Error('Invalid webhook signature');
}
