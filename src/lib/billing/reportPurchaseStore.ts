// Product-specific, one-time report purchase store. This is the ONLY record that
// entitles a user to generate a paid report. Subscription tier and tarot
// entitlements are intentionally NOT consulted here.
//
// Lifecycle: pending -> paid -> consumed.
//   pending  : Stripe Checkout Session created (not yet paid)
//   paid     : payment confirmed by signed webhook OR server-side Stripe retrieval
//   consumed : the matching report was dispatched and correlated to a reading row
//
// Idempotency guarantees:
//   - stripe_session_id / stripe_payment_id are UNIQUE -> one payment = one purchase
//   - consumeReportPurchase() uses SELECT ... FOR UPDATE + a conditional UPDATE so a
//     single paid purchase dispatches exactly one report; a repeat request for an
//     already-consumed purchase returns the existing correlation WITHOUT re-dispatching.
import { query, transaction } from '@/lib/db';
import crypto from 'crypto';

export type ReportPurchaseStatus = 'pending' | 'paid' | 'consumed' | 'failed';

export interface ReportPurchaseRow {
  id: number;
  purchaseId: string;
  userId: number;
  reportType: string;
  sku: string;
  amount: number;
  currency: string;
  status: ReportPurchaseStatus;
  stripeSessionId: string | null;
  stripePaymentId: string | null;
  readingId: number | null;
  reportId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function hydrate(row: any): ReportPurchaseRow {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    userId: Number(row.user_id),
    reportType: row.report_type,
    sku: row.sku,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripe_session_id ?? null,
    stripePaymentId: row.stripe_payment_id ?? null,
    readingId: row.reading_id != null ? Number(row.reading_id) : null,
    reportId: row.report_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Create a pending purchase row. Returns the app-generated purchaseId. */
export async function createReportPurchase(input: {
  userId: number | string;
  reportType: string;
  sku: string;
  amount: number;
  currency?: string;
}): Promise<{ purchaseId: string }> {
  const { rows } = await query(
    `INSERT INTO report_orders (user_id, report_type, sku, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING purchase_id`,
    [Number(input.userId), input.reportType, input.sku, input.amount, input.currency ?? 'usd'],
  );
  return { purchaseId: rows[0].purchase_id };
}

/** Mark a purchase paid from a confirmed Stripe session. Idempotent. */
export async function markReportPurchasePaid(input: {
  purchaseId: string;
  stripeSessionId?: string | null;
  stripePaymentId?: string | null;
}): Promise<boolean> {
  const { rows } = await query(
    `UPDATE report_orders
       SET status = 'paid',
           stripe_session_id = COALESCE($2, stripe_session_id),
           stripe_payment_id = COALESCE($3, stripe_payment_id),
           updated_at = now()
     WHERE purchase_id = $1
       AND status IN ('pending', 'paid')
     RETURNING id`,
    [input.purchaseId, input.stripeSessionId ?? null, input.stripePaymentId ?? null],
  );
  return rows.length > 0;
}

export async function getReportPurchase(purchaseId: string): Promise<ReportPurchaseRow | null> {
  const { rows } = await query(
    `SELECT * FROM report_orders WHERE purchase_id = $1`,
    [purchaseId],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

export async function getReportPurchaseBySession(sessionId: string): Promise<ReportPurchaseRow | null> {
  const { rows } = await query(
    `SELECT * FROM report_orders WHERE stripe_session_id = $1`,
    [sessionId],
  );
  return rows.length ? hydrate(rows[0]) : null;
}

export type ConsumeResult =
  | { outcome: 'consumed'; readingId: number; reportId: string }
  | { outcome: 'already_correlated'; readingId: number; reportId: string }
  | { outcome: 'not_found' }
  | { outcome: 'not_paid' }
  | { outcome: 'wrong_owner' }
  | { outcome: 'wrong_type' };

/**
 * Atomically verify a purchase and correlate it to a freshly created reading.
 * Must be called AFTER the readings row exists (readingId/reportId known).
 *
 * Race-safe: locks the purchase row with FOR UPDATE, then performs a conditional
 * UPDATE that only succeeds when status = 'paid' AND reading_id IS NULL. This
 * guarantees one paid purchase -> one dispatch. A repeat call for an already
 * consumed purchase returns the existing correlation (no double dispatch).
 */
export async function consumeReportPurchase(input: {
  purchaseId: string;
  userId: number | string;
  reportType: string;
  readingId: number | string;
  reportId: string;
}): Promise<ConsumeResult> {
  return transaction(async (tx) => {
    const lock = await tx(
      `SELECT id, user_id, report_type, status, reading_id, report_id
         FROM report_orders WHERE purchase_id = $1 FOR UPDATE`,
      [input.purchaseId],
    );
    if (lock.rows.length === 0) return { outcome: 'not_found' };
    const r = lock.rows[0];
    if (Number(r.user_id) !== Number(input.userId)) return { outcome: 'wrong_owner' };
    if (r.report_type !== input.reportType) return { outcome: 'wrong_type' };

    // Already consumed for a prior (or concurrent) dispatch -> return correlation.
    if (r.status === 'consumed' && r.reading_id != null) {
      return { outcome: 'already_correlated', readingId: Number(r.reading_id), reportId: r.report_id };
    }
    if (r.status !== 'paid') return { outcome: 'not_paid' };

    const upd = await tx(
      `UPDATE report_orders
         SET status = 'consumed', reading_id = $2, report_id = $3, updated_at = now()
       WHERE purchase_id = $1 AND status = 'paid' AND reading_id IS NULL`,
      [input.purchaseId, Number(input.readingId), input.reportId],
    );
    if (upd.rowCount === 0) {
      // Lost a race: re-read to return whatever won.
      const re = await tx(`SELECT reading_id, report_id FROM report_orders WHERE purchase_id = $1`, [input.purchaseId]);
      if (re.rows[0]?.reading_id != null) {
        return { outcome: 'already_correlated', readingId: Number(re.rows[0].reading_id), reportId: re.rows[0].report_id };
      }
      return { outcome: 'not_paid' };
    }
    return { outcome: 'consumed', readingId: Number(input.readingId), reportId: input.reportId };
  });
}
