import { query } from '@/lib/db';
import { WHOP_PLAN_TO_OFFER } from '@/lib/whopCatalog';

export { WHOP_CHECKOUT_URLS, WHOP_PLAN_TO_OFFER } from '@/lib/whopCatalog';

export type WhopOffer = typeof WHOP_PLAN_TO_OFFER[keyof typeof WHOP_PLAN_TO_OFFER];
export type WhopEventType = 'payment.succeeded' | 'refund.created';

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
  email: string;
  planId: string;
}): Promise<{ applied: boolean; reason: string; offer?: WhopOffer; userId?: number }> {
  const offer = offerForPlan(input.planId);
  if (!offer) return { applied: false, reason: 'unsupported-plan' };
  const email = input.email.trim().toLowerCase();
  if (!email) return { applied: false, reason: 'missing-email', offer };

  const users = await query('SELECT id FROM users WHERE lower(email) = $1 LIMIT 1', [email]);
  const userId = users.rows[0]?.id == null ? null : Number(users.rows[0].id);
  if (input.eventType === 'payment.succeeded') {
    const inserted = await query(
      `INSERT INTO whop_entitlements (user_id, email, offer, plan_id, payment_id, status, granted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', now(), now())
       ON CONFLICT (payment_id) DO NOTHING
       RETURNING id`,
      [userId, email, offer, input.planId, input.paymentId],
    );
    return {
      applied: inserted.rowCount === 1,
      reason: inserted.rowCount === 1 ? (userId == null ? 'pending-user-match' : 'unlocked') : 'duplicate',
      offer,
      ...(userId == null ? {} : { userId }),
    };
  }

  const revoked = await query(
    `UPDATE whop_entitlements
        SET status = 'revoked', revoked_at = COALESCE(revoked_at, now()), updated_at = now()
      WHERE payment_id = $1 AND status = 'active'`,
    [input.paymentId],
  );
  return { applied: revoked.rowCount === 1, reason: revoked.rowCount === 1 ? 'revoked' : 'already-revoked-or-missing', offer, ...(userId == null ? {} : { userId }) };
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
