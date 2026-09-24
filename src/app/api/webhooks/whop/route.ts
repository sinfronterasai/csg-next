import { after, NextResponse, type NextRequest } from 'next/server';
import { offerForPlan, processWhopPayment, resolveWhopPlanId } from '@/lib/whop';
import { verifyWhopSignature } from '@/lib/whopSignature';

async function handleWhopEvent(event: any): Promise<void> {
  const payment = event?.data;
  const eventType = event?.type;
  if (eventType !== 'payment.succeeded' && eventType !== 'refund.created') return;
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  const email = typeof payment?.customer_email === 'string' ? payment.customer_email : '';
  const planId = resolveWhopPlanId(payment);
  if (!paymentId || !email || !planId || !offerForPlan(planId)) return;
  await processWhopPayment({ eventType, paymentId, email, planId });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  try {
    verifyWhopSignature(rawBody, request.headers, process.env.WHOP_WEBHOOK_SECRET ?? '');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature';
    const status = message === 'WHOP_WEBHOOK_SECRET is not configured' ? 500 : 400;
    return NextResponse.json({ error: status === 500 ? 'Webhook configuration error' : 'Invalid signature' }, { status });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  // Acknowledge immediately; Whop retries are safe because payment_id is unique.
  after(async () => {
    try {
      await handleWhopEvent(event);
    } catch (error) {
      console.error('[whop/webhook] background processing failed:', error instanceof Error ? error.message : 'unknown error');
    }
  });
  return new Response('OK', { status: 200 });
}
