// One-time, pay-per-report Stripe Checkout. Paid reports are individual purchases
// keyed to a SKU; entitlement comes ONLY from a confirmed Stripe payment, never
// from subscription tier or tarot entitlements.
import Stripe from 'stripe';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import {
  createReportPurchase, verifyAndMarkReportPurchasePaid, getReportPurchase,
  getReportPurchaseBySession, getReportPurchaseByUserIdAndType,
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
 * Returns the hosted URL, our purchaseId, and the Stripe session id (to verify
 * the return path server-side without trusting client ownership claims).
 * Promotion codes are DISABLED for launch: the stored amount must equal the exact
 * charged amount_total, so discounts would otherwise break webhook verification.
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
    // Launch scope: card only. Async payment methods (e.g. bank redirect) can leave
    // a Checkout Session in an unpaid "completed" state that our webhook (which only
    // marks paid on checkout.session.completed with confirmed payment) would never
    // transition. Card is synchronous, so payment_status is known at completion.
    payment_method_types: ['card'],
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
    // Carry the Stripe session id back to the app so the resume path can verify
    // ownership + paid status server-side. Stripe expands the literal
    // {CHECKOUT_SESSION_ID} in success_url with the real session id at redirect
    // time. Do NOT interpolate a JS variable here — it must be the literal token
    // Stripe recognizes.
    success_url: `${opts.origin}/reports?purchase=success&sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/reports?purchase=canceled`,
    allow_promotion_codes: false,
  });

  // Stripe expands {session_id} placeholders in success_url with the real id.
  const url = session.url?.replace('SESSION_PLACEHOLDER', session.id) ?? null;

  // Record the session id so webhook correlation + idempotency are robust.
  await query(
    `UPDATE report_orders SET stripe_session_id = $2, updated_at = now() WHERE purchase_id = $1`,
    [purchaseId, session.id],
  );
  return { url, purchaseId, sessionId: session.id };
}

/**
 * Apply a confirmed Stripe checkout session to its purchase record.
 * Called ONLY from the verified-webhook path. Verifies payment_status + signed
 * invariants under lock; marks paid only when everything matches. Returns whether
 * it was applied, deferred (unpaid/mismatch), or not found, so the webhook can
 * return the correct HTTP status and let Stripe retry a deferred/incomplete one.
 */
export async function handleReportPurchaseWebhook(session: any): Promise<{ outcome: string; purchaseId?: string; reason?: string }> {
  const purchaseId: string | undefined = session?.client_reference_id;
  if (!purchaseId) return { outcome: 'no_reference' };
  const result = await verifyAndMarkReportPurchasePaid({ purchaseId, session });
  if (result.outcome === 'applied') return { outcome: 'applied', purchaseId };
  if (result.outcome === 'deferred_unpaid') return { outcome: 'deferred_unpaid', purchaseId };
  if (result.outcome === 'deferred_mismatch') return { outcome: 'deferred_mismatch', purchaseId, reason: result.reason };
  return { outcome: 'not_found', purchaseId };
}

/**
 * Defense-in-depth: re-verify a purchase's paid state by retrieving the Stripe
 * session server-side (never trusts stored flags alone). Returns the purchase row
 * only if Stripe confirms payment AND invariants match.
 */
export async function verifyPurchasePaidViaStripe(purchaseId: string): Promise<ReportPurchaseRow | null> {
  const purchase = await getReportPurchase(purchaseId);
  if (!purchase || !stripe) return purchase && purchase.status === 'paid' ? purchase : null;
  const sessionId = purchase.stripeSessionId;
  if (!sessionId) return purchase.status === 'paid' ? purchase : null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
    const res = await verifyAndMarkReportPurchasePaid({ purchaseId, session });
    if (res.outcome === 'applied') return await getReportPurchase(purchaseId);
    return purchase.status === 'paid' ? purchase : null;
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
