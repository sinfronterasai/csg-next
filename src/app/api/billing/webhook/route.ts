import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, handleStripeEvent, pgBillingDb } from '@/lib/billing/stripe';
import { handleReportPurchaseWebhook } from '@/lib/billing/reportPurchase';

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

  try {
    // Report purchases are one-time payments with metadata.kind='report'.
    // They are handled by the report purchase store, never the subscription path.
    if (
      event.type === 'checkout.session.completed' &&
      event.data?.object?.metadata?.kind === 'report'
    ) {
      const result = await handleReportPurchaseWebhook(event.data.object);
      return NextResponse.json({ received: true, reportPurchase: result });
    }

    const result = await handleStripeEvent(pgBillingDb, event);
    return NextResponse.json({ received: true, ...result });
  } catch (err: any) {
    // Return 200 so Stripe does not retry indefinitely on a non-webhook error,
    // but log for observability.
    console.error('[billing/webhook] handler error:', err?.message);
    return NextResponse.json({ received: true, error: 'handler-failed' }, { status: 200 });
  }
}
