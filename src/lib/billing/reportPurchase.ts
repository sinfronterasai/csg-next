// One-time, pay-per-report Stripe Checkout. Paid reports are individual purchases
// keyed to a SKU; entitlement comes ONLY from a confirmed Stripe payment, never
// from subscription tier or tarot entitlements.
import Stripe from 'stripe';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import {
  createReportPurchase, markReportPurchasePaid, getReportPurchase, getReportPurchaseBySession,
  type ReportPurchaseRow,
} from '@/lib/billing/reportPurchaseStore';

const secret = process.env.STRIPE_SECRET_KEY;
const stripe: any = secret ? new Stripe(secret) : null;

export function reportSku(type: ReportType): string {
  return `report-${type}`;
}

// Paid pipeline reports only. Free reports (price 0) have no purchase.
export function isPaidReportType(type: ReportType): boolean {
  return (REPORT_META[type]?.price ?? 0) > 0;
}

/**
 * Create a pending purchase record + a one-time Stripe Checkout Session.
 * Returns the hosted URL and our purchaseId (to pass back into /api/reports/generate).
 */
export async function createReportCheckoutSession(opts: {
  userId: number | string;
  reportType: ReportType;
  email: string;
  origin: string;
}): Promise<{ url: string | null; purchaseId: string | null; sessionId: string | null }> {
  if (!stripe) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  if (!isPaidReportType(opts.reportType)) {
    throw new Error(`Report type '${opts.reportType}' is free and does not require purchase.`);
  }
  const meta = REPORT_META[opts.reportType];
  const amountCents = Math.round(meta.price * 100);
  const sku = reportSku(opts.reportType);

  const { purchaseId } = await createReportPurchase({
    userId: opts.userId,
    reportType: opts.reportType,
    sku,
    amount: amountCents,
    currency: 'usd',
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: purchaseId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: meta.title },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { kind: 'report', userId: String(opts.userId), reportType: opts.reportType, sku },
    success_url: `${opts.origin}/reports?purchase=success&type=${opts.reportType}`,
    cancel_url: `${opts.origin}/reports?purchase=canceled`,
    allow_promotion_codes: true,
  });

  // Record the session id so webhook correlation + idempotency are robust.
  await query(
    `UPDATE report_orders SET stripe_session_id = $2, updated_at = now() WHERE purchase_id = $1`,
    [purchaseId, session.id],
  );
  return { url: session.url, purchaseId, sessionId: session.id };
}

/**
 * Apply a confirmed Stripe checkout session to its purchase record.
 * Called ONLY from the verified-webhook path. Idempotent.
 */
export async function handleReportPurchaseWebhook(session: any): Promise<{ applied: boolean; purchaseId?: string }> {
  const purchaseId: string | undefined = session?.client_reference_id;
  if (!purchaseId) return { applied: false };
  const paymentId: string | undefined =
    session?.payment_intent?.id ?? session?.payment_intent ?? session?.id ?? undefined;
  const ok = await markReportPurchasePaid({ purchaseId, stripeSessionId: session?.id, stripePaymentId: paymentId });
  return { applied: ok, purchaseId };
}

/**
 * Defense-in-depth: re-verify a purchase's paid state by retrieving the Stripe
 * session server-side (never trusts stored flags alone). Returns the purchase row
 * only if Stripe confirms payment.
 */
export async function verifyPurchasePaidViaStripe(purchaseId: string): Promise<ReportPurchaseRow | null> {
  const purchase = await getReportPurchase(purchaseId);
  if (!purchase || !stripe) return purchase && purchase.status === 'paid' ? purchase : null;
  const sessionId = purchase.stripeSessionId;
  if (!sessionId) return purchase.status === 'paid' ? purchase : null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    const pi = session.payment_intent;
    const paid = session.payment_status === 'paid' || pi?.status === 'succeeded';
    if (paid && purchase.status !== 'paid') {
      await markReportPurchasePaid({ purchaseId, stripeSessionId: sessionId, stripePaymentId: pi?.id });
      return await getReportPurchase(purchaseId);
    }
    return paid ? purchase : null;
  } catch {
    // Stripe retrieval failed -> fall back to stored state (set by webhook).
    return purchase.status === 'paid' ? purchase : null;
  }
}

// Re-exported for non-entitlement price checks (e.g. editor routing). This is a
// pure price check, NOT a grant of entitlement from subscription/tarot.
export function isPaidReport(type: ReportType): boolean {
  return isPaidReportType(type);
}
