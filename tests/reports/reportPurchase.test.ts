// Store-level tests for the per-report purchase store: atomic/idempotent
// consumption (one paid purchase -> one report), and rejection of wrong owner,
// wrong type, and not-paid/unpaid states.
import { consumeReportPurchase, createReportPurchase, markReportPurchasePaid, getReportPurchase } from '@/lib/billing/reportPurchaseStore';

// In-memory fake of report_orders with FOR UPDATE + conditional UPDATE semantics.
const table: any[] = [];
function fakeDb() {
  return {
    async query(text: string, params: any[] = []) {
      // INSERT ... RETURNING purchase_id
      if (text.startsWith('INSERT INTO report_orders')) {
        const row = {
          id: table.length + 1,
          purchase_id: 'gen-' + (table.length + 1),
          user_id: params[0], report_type: params[1], sku: params[2],
          amount: params[3], currency: params[4] ?? 'usd', status: 'pending',
          stripe_session_id: null, stripe_payment_id: null,
          reading_id: null, report_id: null,
          created_at: new Date(), updated_at: new Date(),
        };
        table.push(row);
        return { rows: [{ purchase_id: row.purchase_id }], rowCount: 1 };
      }
      // UPDATE ... WHERE purchase_id = $1 AND status IN ('pending','paid') RETURNING id
      if (text.includes("status IN ('pending', 'paid')")) {
        const r = table.find((x) => x.purchase_id === params[0]);
        if (r && (r.status === 'pending' || r.status === 'paid')) {
          r.status = 'paid';
          r.stripe_session_id = params[1] ?? r.stripe_session_id;
          r.stripe_payment_id = params[2] ?? r.stripe_payment_id;
          r.updated_at = new Date();
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // SELECT ... FOR UPDATE
      if (text.includes('FOR UPDATE')) {
        const r = table.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      // SELECT * FROM report_orders WHERE purchase_id = $1
      if (text.includes('SELECT * FROM report_orders')) {
        const r = table.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      // UPDATE ... SET status='consumed' ... WHERE purchase_id=$1 AND status='paid' AND reading_id IS NULL
      if (text.includes("SET status = 'consumed'")) {
        const r = table.find((x) => x.purchase_id === params[0]);
        if (r && r.status === 'paid' && r.reading_id == null) {
          r.status = 'consumed'; r.reading_id = params[1]; r.report_id = params[2]; r.updated_at = new Date();
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // UPDATE ... SET stripe_session_id (from checkout)
      if (text.includes('SET stripe_session_id')) {
        const r = table.find((x) => x.purchase_id === params[0]);
        if (r) r.stripe_session_id = params[1];
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

beforeEach(() => { table.length = 0; jest.clearAllMocks(); });
// Patch the module's db import by providing our fake via jest.mock.
jest.mock('@/lib/db', () => {
  // Lazy: we replace query/transaction at call time in each test.
  return { query: jest.fn(), transaction: jest.fn() };
});

import * as db from '@/lib/db';

function installFake() {
  const fake = fakeDb();
  (db.query as jest.Mock).mockImplementation((t: string, p: any[] = []) => fake.query(t, p));
  (db.transaction as jest.Mock).mockImplementation(async (fn: any) => fn(async (t: string, p: any[] = []) => fake.query(t, p)));
}

describe('createReportPurchase', () => {
  it('creates a pending purchase with a purchaseId', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    expect(purchaseId).toBeTruthy();
    const p = await getReportPurchase(purchaseId);
    expect(p?.status).toBe('pending');
    expect(p?.userId).toBe(7);
    expect(p?.reportType).toBe('transit');
  });
});

describe('markReportPurchasePaid (webhook)', () => {
  it('marks pending -> paid idempotently', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    expect(await markReportPurchasePaid({ purchaseId, stripePaymentId: 'pi_1' })).toBe(true);
    expect((await getReportPurchase(purchaseId))?.status).toBe('paid');
    expect(await markReportPurchasePaid({ purchaseId, stripePaymentId: 'pi_1' })).toBe(true); // idempotent
  });
});

describe('consumeReportPurchase (atomic, one purchase -> one report)', () => {
  async function paidPurchase() {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    await markReportPurchasePaid({ purchaseId, stripePaymentId: 'pi_1' });
    return purchaseId;
  }

  it('consumes a paid purchase once', async () => {
    const id = await paidPurchase();
    const r1 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', readingId: 101, reportId: 'rid-A' });
    expect(r1.outcome).toBe('consumed');
    const r2 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', readingId: 102, reportId: 'rid-B' });
    // Already correlated: returns the SAME correlation, does NOT overwrite.
    expect(r2.outcome).toBe('already_correlated');
    expect(r2.readingId).toBe(101);
    expect(r2.reportId).toBe('rid-A');
  });

  it('wrong owner -> wrong_owner (no consume)', async () => {
    const id = await paidPurchase();
    const r = await consumeReportPurchase({ purchaseId: id, userId: 999, reportType: 'transit', readingId: 101, reportId: 'rid-A' });
    expect(r.outcome).toBe('wrong_owner');
  });

  it('wrong report type (SKU mismatch) -> wrong_type', async () => {
    const id = await paidPurchase();
    const r = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'fullcosmic', readingId: 101, reportId: 'rid-A' });
    expect(r.outcome).toBe('wrong_type');
  });

  it('unpaid (pending) purchase -> not_paid', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    const r = await consumeReportPurchase({ purchaseId, userId: 7, reportType: 'transit', readingId: 101, reportId: 'rid-A' });
    expect(r.outcome).toBe('not_paid');
  });

  it('unknown purchaseId -> not_found', async () => {
    installFake();
    const r = await consumeReportPurchase({ purchaseId: 'nope', userId: 7, reportType: 'transit', readingId: 101, reportId: 'rid-A' });
    expect(r.outcome).toBe('not_found');
  });
});
