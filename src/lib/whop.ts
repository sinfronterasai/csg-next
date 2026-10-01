import { query, transaction } from '@/lib/db';
import { PAID_PRODUCT_IDS, PRODUCT_CATALOG, type ProductCatalogEntry } from '@/lib/productCatalog';
import { WHOP_PLAN_TO_OFFER } from '@/lib/whopCatalog';
import { insertWhopReportPurchase } from '@/lib/billing/reportPurchaseStore';

export { WHOP_CHECKOUT_URLS, WHOP_PLAN_TO_OFFER } from '@/lib/whopCatalog';

export type WhopOffer = typeof WHOP_PLAN_TO_OFFER[keyof typeof WHOP_PLAN_TO_OFFER];
export type WhopEventType = 'payment.succeeded' | 'refund.created';

export function productForWhopPlan(planId: string | null): ProductCatalogEntry | null {
  if (!planId) return null;
  const productId = PAID_PRODUCT_IDS.find((id) => PRODUCT_CATALOG[id].whopPlanId === planId);
  return productId ? PRODUCT_CATALOG[productId] : null;
}

export function resolveWhopPlanId(payment: any): string | null {
  if (typeof payment?.plan_id === 'string' && payment.plan_id) return payment.plan_id;
  const lineItem = Array.isArray(payment?.line_items)
    ? payment.line_items.find((item: any) => typeof item?.plan_id === 'string' && item.plan_id)
    : null;
  return lineItem?.plan_id ?? null;
}

export function offerForPlan(planId: string | null): WhopOffer | null {
  if (!planId) return null;
  return (WHOP_PLAN_TO_OFFER as Record<string, WhopOffer>)[planId] ?? null;
}

export async function processWhopPayment(input: {
  eventType: WhopEventType;
  paymentId: string;
  email?: string;
  planId: string | null;
}): Promise<{ applied: boolean; reason: string; offer?: WhopOffer; userId?: number }> {
  const product = productForWhopPlan(input.planId);
  const offer = product?.whopOfferId as WhopOffer | undefined;
  if (!input.paymentId) return { applied: false, reason: 'missing-payment-id', ...(offer ? { offer } : {}) };
  if (input.eventType === 'payment.succeeded' && (!product || !offer || !input.planId)) return { applied: false, reason: 'unsupported-plan' };
  const reportProduct = input.eventType === 'payment.succeeded' ? product : null;
  const paidPlanId = input.eventType === 'payment.succeeded' ? input.planId : null;
  const email = input.email?.trim().toLowerCase() ?? '';
  if (input.eventType === 'payment.succeeded' && !email) return { applied: false, reason: 'missing-email', offer };

  const users = email ? await query('SELECT id FROM users WHERE lower(email) = $1', [email]) : { rows: [] };
  if (users.rows.length > 1) return { applied: false, reason: 'ambiguous-identity', offer };
  const userId = users.rows[0]?.id == null ? null : Number(users.rows[0].id);

  return transaction(async (tx) => {
    await tx('BEGIN');
    try {
    if (input.eventType === 'payment.succeeded') {
      const lifecycle = await tx(
        `INSERT INTO whop_payment_events (payment_id, state, plan_id, email, created_at, updated_at)
         VALUES ($1, 'succeeded', $2, $3, now(), now())
         ON CONFLICT (payment_id) DO NOTHING
         RETURNING state`,
        [input.paymentId, paidPlanId, email],
      );
      if (lifecycle.rowCount !== 1) {
        const prior = await tx(
          'SELECT state FROM whop_payment_events WHERE payment_id = $1 FOR UPDATE',
          [input.paymentId],
        );
        if (prior.rows[0]?.state === 'refunded') {
          await tx('COMMIT');
          return { applied: false, reason: 'already-refunded', offer };
        }
      }
      const entitlement = await tx(
          `INSERT INTO whop_entitlements (user_id, email, offer, plan_id, payment_id, status, granted_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', now(), now())
           ON CONFLICT (payment_id) DO NOTHING
           RETURNING id`,
          [userId, email, offer, input.planId, input.paymentId],
        );
        let reportPurchase: { purchaseId: string | null; created: boolean } | null = null;
        if (reportProduct?.reportType && reportProduct.sku && reportProduct.priceCents > 0) {
          reportPurchase = await insertWhopReportPurchase(tx, {
            reportType: reportProduct.reportType,
            sku: reportProduct.sku,
            amount: reportProduct.priceCents,
            currency: reportProduct.currency,
            providerPaymentId: input.paymentId,
            providerPlanId: paidPlanId as string,
            purchaserEmail: email,
            userId,
          });
        }
        await tx('COMMIT');
        const applied = entitlement.rowCount === 1 || reportPurchase?.created === true;
        return {
          applied,
          reason: applied ? (userId == null ? 'pending-user-match' : 'unlocked') : 'duplicate',
          offer,
          ...(userId == null ? {} : { userId }),
        };
      }

      await tx(
        `INSERT INTO whop_payment_events (payment_id, state, plan_id, email, created_at, updated_at)
         VALUES ($1, 'refunded', $2, NULLIF($3, ''), now(), now())
         ON CONFLICT (payment_id)
         DO UPDATE SET state = 'refunded', plan_id = COALESCE(EXCLUDED.plan_id, whop_payment_events.plan_id),
                       email = COALESCE(EXCLUDED.email, whop_payment_events.email), updated_at = now()`,
        [input.paymentId, input.planId, email],
      );
      const revoked = await tx(
        `UPDATE whop_entitlements
            SET status = 'revoked', revoked_at = COALESCE(revoked_at, now()), updated_at = now()
          WHERE payment_id = $1 AND status = 'active'`,
        [input.paymentId],
      );
      const reportRevoked = await tx(
        `UPDATE report_orders
            SET status = 'refunded', updated_at = now()
          WHERE provider = 'whop' AND provider_payment_id = $1 AND status IN ('paid', 'consumed')`,
        [input.paymentId],
      );
      await tx('COMMIT');
      const applied = revoked.rowCount === 1 || reportRevoked.rowCount === 1;
      return {
        applied,
        reason: applied ? 'revoked' : 'already-revoked-or-missing',
        offer,
        ...(userId == null ? {} : { userId }),
      };
    } catch (error) {
      await tx('ROLLBACK');
      throw error;
    }
  });
}

export async function hasWhopOffer(userId: number | string, offer: WhopOffer): Promise<boolean> {
  try {
    const result = await query(
      `SELECT 1
         FROM whop_entitlements e
         LEFT JOIN users u ON u.id = $1
        WHERE e.offer = $2 AND e.status = 'active'
          AND (e.user_id = $1 OR lower(e.email) = lower(u.email))
        LIMIT 1`,
      [Number(userId), offer],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function getWhopOffers(userId: number | string): Promise<WhopOffer[]> {
  try {
    const result = await query(
      `SELECT DISTINCT offer FROM whop_entitlements WHERE user_id = $1 AND status = 'active'`,
      [Number(userId)],
    );
    return result.rows.map((row: any) => row.offer as WhopOffer);
  } catch {
    return [];
  }
}
