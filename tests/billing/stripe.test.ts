import {
  tierFromMetadata,
  buildUserUpdate,
  buildCancelUpdate,
  handleStripeEvent,
  type BillingDb,
} from '@/lib/billing/stripe';
import type { Tier } from '@/lib/billing/stripe';

interface TestDb extends BillingDb {
  users: Map<number, any>;
}

function makeDb(): TestDb {
  const processed = new Set<string>();
  const users = new Map<number, any>();
  return {
    users,
    async isProcessed(id) {
      return processed.has(id);
    },
    async markProcessed(id) {
      processed.add(id);
    },
    async applyUserUpdate(userId, update) {
      users.set(Number(userId), { ...(users.get(Number(userId)) || {}), ...update });
    },
  };
}

describe('billing tier helpers (pure)', () => {
  it('tierFromMetadata maps known tiers and rejects garbage', () => {
    expect(tierFromMetadata({ tier: 'premium' })).toBe('premium');
    expect(tierFromMetadata({ tier: 'premium_plus' })).toBe('premium_plus');
    expect(tierFromMetadata({ tier: 'nonsense' })).toBeNull();
    expect(tierFromMetadata(undefined)).toBeNull();
  });

  it('buildUserUpdate fails safe on invalid tier', () => {
    expect(buildUserUpdate('bogus' as Tier, {})).toBeNull();
    const u = buildUserUpdate('premium', { customer: 'cus_x', id: 'sub_y' });
    expect(u?.subscription_tier).toBe('premium');
    expect(u?.subscription_status).toBe('active');
    expect(u?.stripe_customer_id).toBe('cus_x');
    expect(u?.stripe_subscription_id).toBe('sub_y');
  });

  it('buildCancelUpdate downgrades to free/canceled', () => {
    const c = buildCancelUpdate();
    expect(c.subscription_tier).toBe('free');
    expect(c.subscription_status).toBe('canceled');
  });
});

describe('handleStripeEvent (idempotent entitlement apply)', () => {
  it('checkout.session.completed applies premium entitlement', async () => {
    const db = makeDb();
    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tier: 'premium', userId: '42' }, customer: 'cus_1', subscription: 'sub_1' } },
    };
    const res = await handleStripeEvent(db, event);
    expect(res.applied).toBe(true);
    expect(res.tier).toBe('premium');
    expect(db.users.get(42).subscription_tier).toBe('premium');
    expect(db.users.get(42).subscription_status).toBe('active');
  });

  it('duplicate event is idempotent', async () => {
    const db = makeDb();
    const ev = {
      id: 'evt_dup',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tier: 'premium_plus', userId: '7' }, customer: 'c', subscription: 's' } },
    };
    const r1 = await handleStripeEvent(db, ev);
    const r2 = await handleStripeEvent(db, ev);
    expect(r1.applied).toBe(true);
    expect(r2.applied).toBe(false);
    expect(r2.reason).toBe('duplicate');
  });

  it('subscription.deleted downgrades to free/canceled', async () => {
    const db = makeDb();
    db.users.set(9, { subscription_tier: 'premium', subscription_status: 'active' });
    const ev = {
      id: 'evt_del',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_9', metadata: { userId: '9' } } },
    };
    const res = await handleStripeEvent(db, ev);
    expect(res.applied).toBe(true);
    expect(db.users.get(9).subscription_tier).toBe('free');
    expect(db.users.get(9).subscription_status).toBe('canceled');
  });

  it('event without userId is a safe no-op and still marked processed', async () => {
    const db = makeDb();
    const ev = {
      id: 'evt_nonuser',
      type: 'checkout.session.completed',
      data: { object: { metadata: { tier: 'premium' } } },
    };
    const res = await handleStripeEvent(db, ev);
    expect(res.applied).toBe(false);
    expect(res.reason).toBe('no-user');
    expect(await db.isProcessed('evt_nonuser')).toBe(true);
  });
});
