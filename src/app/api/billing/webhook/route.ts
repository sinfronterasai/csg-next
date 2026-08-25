import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, handleStripeEvent, pgBillingDb } from '@/lib/billing/stripe';
import { handleReportPurchaseWebhook } from '@/lib/billing/reportPurchase';

// Events we intentionally ignore and will never act on. For these, a 2xx keeps
// Stripe from retrying endlessly. Everything else that we fail to process must
// return 5xx so Stripe retries (the handlers are idempotent, so retries are safe).
const IGNORED_EVENT_TYPES = new Set([
  'payment_intent.created',
  'payment_intent.payment_failed',
  'charge.updated',
  'customer.created',
  'customer.updated',
]);

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature.' }, { status: 400 });

  const raw = await request.text();
  let event: any;
  try {
    event = verifyWebhook(raw, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // Unknown / irrelevant event types: acknowledge without processing.
  if (IGNORED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    // Report purchases are one-time payments with metadata.kind='report'.
    // They are handled by the report purchase store, never the subscription path.
    if (
      event.type === 'checkout.session.completed' &&
      event.data?.object?.metadata?.kind === 'report'
    ) {
      const result = await handleReportPurchaseWebhook(event.data.object);
      // applied -> 200. deferred (unpaid/async) or mismatch -> 200 but flagged
      // (these are expected states, not failures; do NOT 5xx or Stripe retries
      // harmlessly, but the order correctly stays pending).
      return NextResponse.json({ received: true, reportPurchase: result });
    }

    const result = await handleStripeEvent(pgBillingDb, event);
    return NextResponse.json({ received: true, ...result });
  } catch (err: any) {
    // Transient DB/logic failure: return 5xx so Stripe retries. Idempotent, safe.
    console.error('[billing/webhook] handler error (will retry):', err?.message);
    return NextResponse.json({ received: false, error: 'handler-failed' }, { status: 500 });
  }
}
