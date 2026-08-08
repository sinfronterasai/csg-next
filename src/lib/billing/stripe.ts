import Stripe from 'stripe';
import { query } from '@/lib/db';

const secret = process.env.STRIPE_SECRET_KEY;
const stripe = secret ? new Stripe(secret) : null;

export type Tier = 'free' | 'premium' | 'premium_plus';

const TIER_BY_NAME: Record<string, Tier> = {
  free: 'free',
  premium: 'premium',
  premium_plus: 'premium_plus',
};

// Stripe Price IDs per tier (set in Stripe Dashboard -> Products). Free is not purchasable.
const PRICE_BY_TIER: Partial<Record<Tier, string | undefined>> = {
  premium: process.env.STRIPE_PRICE_PREMIUM,
  premium_plus: process.env.STRIPE_PRICE_PREMIUM_PLUS,
};

export function tierFromMetadata(meta: Record<string, any> | undefined | null): Tier | null {
  if (!meta) return null;
  return TIER_BY_NAME[meta.tier] ?? null;
}

export function tierFromPrice(priceId: string | undefined): Tier | null {
  if (!priceId) return null;
  for (const t of Object.keys(PRICE_BY_TIER) as Tier[]) {
    if (PRICE_BY_TIER[t] === priceId) return t;
  }
  return null;
}

// Fail-safe: invalid tier -> null (never grants a tier).
export function buildUserUpdate(tier: Tier | null, sub: Record<string, any> = {}): Record<string, any> | null {
  if (!tier || !TIER_BY_NAME[tier]) return null;
  const toIso = (secs: number | undefined) => (secs ? new Date(secs * 1000).toISOString() : null);
  return {
    subscription_tier: tier,
    subscription_status: 'active',
    stripe_customer_id: sub.customer ?? null,
    stripe_subscription_id: sub.id ?? null,
    subscription_current_period_start: toIso(sub.current_period_start),
    subscription_current_period_end: toIso(sub.current_period_end),
  };
}

export function buildCancelUpdate(): Record<string, any> {
  return { subscription_tier: 'free', subscription_status: 'canceled', subscription_current_period_end: null };
}

export interface BillingDb {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  applyUserUpdate(userId: string | number, update: Record<string, any>): Promise<void>;
}

// Real DB adapter backed by the pg pool.
export const pgBillingDb: BillingDb = {
  async isProcessed(eventId) {
    const { rows } = await query('SELECT 1 FROM stripe_processed_events WHERE event_id = $1', [eventId]);
    return rows.length > 0;
  },
  async markProcessed(eventId) {
    await query(
      'INSERT INTO stripe_processed_events (event_id, processed_at) VALUES ($1, now()) ON CONFLICT DO NOTHING',
      [eventId],
    );
  },
  async applyUserUpdate(userId, update) {
    const cols = Object.keys(update);
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const vals = cols.map((c) => update[c]);
    await query(`UPDATE users SET ${sets} WHERE id = $${cols.length + 1}`, [...vals, Number(userId)]);
  },
};

/**
 * Apply a verified Stripe webhook event to the user record.
 * Idempotent via stripe_processed_events. Returns what happened.
 */
export async function handleStripeEvent(
  db: BillingDb,
  event: any,
): Promise<{ applied: boolean; reason?: string; tier?: Tier | null }> {
  if (await db.isProcessed(event.id)) return { applied: false, reason: 'duplicate' };

  const obj = event.data?.object ?? {};
  let update: Record<string, any> | null = null;
  let userId: string | number | null = obj.metadata?.userId ?? obj.metadata?.user_id ?? null;

  if (event.type === 'checkout.session.completed') {
    const tier = tierFromMetadata(obj.metadata);
    update = buildUserUpdate(tier, { customer: obj.customer, id: obj.subscription });
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const tier = tierFromMetadata(obj.metadata) ?? tierFromPrice(obj?.items?.data?.[0]?.price?.id);
    update = buildUserUpdate(tier, obj);
  } else if (event.type === 'customer.subscription.deleted') {
    update = buildCancelUpdate();
  }

  if (!update || !userId) {
    await db.markProcessed(event.id);
    return { applied: false, reason: update ? 'no-user' : 'no-op' };
  }

  await db.applyUserUpdate(userId, update);
  await db.markProcessed(event.id);
  return { applied: true, tier: update.subscription_tier };
}

/** Create a Stripe Checkout Session for a tier. Returns the hosted URL. */
export async function createCheckoutSession(opts: {
  userId: number | string;
  email: string;
  tier: Tier;
  origin: string;
}): Promise<{ url: string | null; sessionId: string | null }> {
  if (!stripe) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  if (opts.tier === 'free') throw new Error('Free tier is not purchasable.');
  const priceId = PRICE_BY_TIER[opts.tier];
  if (!priceId) throw new Error(`No STRIPE_PRICE_* configured for tier ${opts.tier}.`);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: opts.email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: String(opts.userId), tier: opts.tier },
    success_url: `${opts.origin}/tarot?upgrade=success`,
    cancel_url: `${opts.origin}/tarot/pricing?upgrade=canceled`,
    allow_promotion_codes: true,
  });
  return { url: session.url, sessionId: session.id };
}

export function verifyWebhook(rawBody: Buffer | string, signature: string): any {
  if (!stripe) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
