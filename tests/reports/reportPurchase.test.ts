// Store-level tests for the per-report purchase store under the payment-integrity
// review: UUID validation, invariant-checked paid marking, atomic
// reading-creation + consumption (no orphan), and correct repeat/status behavior.
import {
  isValidPurchaseId, isValidSkuPair, createReportPurchase, verifyAndMarkReportPurchasePaid,
  getReportPurchase, consumeReportPurchase,
} from '@/lib/billing/reportPurchaseStore';

const orders: any[] = [];
const readings: any[] = [];

function fakeDb() {
  return {
    async query(text: string, params: any[] = []) {
      // INSERT purchase (pending)
      if (text.startsWith('INSERT INTO report_orders')) {
        const row = {
          id: orders.length + 1, purchase_id: '00000000-0000-0000-0000-' + String(orders.length + 1).padStart(12, '0'),
          user_id: params[0], report_type: params[1], sku: params[2],
          amount: params[3], currency: params[4] ?? 'usd', status: 'pending',
          stripe_session_id: null, stripe_payment_id: null,
          reading_id: null, report_id: null, created_at: new Date(), updated_at: new Date(),
        };
        orders.push(row);
        return { rows: [{ purchase_id: row.purchase_id }], rowCount: 1 };
      }
      // UPDATE ... SET status='paid' (from verifyAndMark)
      if (text.includes("SET status = 'paid'")) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        if (r && (r.status === 'pending' || r.status === 'paid')) {
          r.status = 'paid'; r.stripe_session_id = params[1] ?? r.stripe_session_id; r.stripe_payment_id = params[2] ?? r.stripe_payment_id;
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // SELECT ... FOR UPDATE (purchase lock)
      if (text.includes('FOR UPDATE') && text.includes('report_orders')) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      // INSERT reading (inside consume transaction)
      if (text.startsWith('INSERT INTO readings')) {
        const row = {
          id: readings.length + 1, user_id: params[0], type: params[1], title: params[2],
          pipeline_status: params[5], result: JSON.parse(params[4]),
        };
        readings.push(row);
        return { rows: [{ id: row.id }], rowCount: 1 };
      }
      // UPDATE report_orders ... SET status='consumed' (correlate)
      if (text.includes("SET status = 'consumed'")) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        if (r && r.status === 'paid' && r.reading_id == null) {
          r.status = 'consumed'; r.reading_id = params[1]; r.report_id = params[2];
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // SELECT pipeline_status FROM readings (for already_correlated status)
      if (text.includes('SELECT pipeline_status FROM readings')) {
        const r = readings.find((x) => x.id === Number(params[0]));
        return { rows: r ? [{ pipeline_status: r.pipeline_status }] : [], rowCount: r ? 1 : 0 };
      }
      // SELECT * FROM report_orders WHERE purchase_id (getReportPurchase; guarded by UUID check)
      if (text.includes('SELECT * FROM report_orders')) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      // UPDATE report_orders SET stripe_session_id (from checkout)
      if (text.includes('SET stripe_session_id')) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        if (r) r.stripe_session_id = params[1];
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

beforeEach(() => { orders.length = 0; readings.length = 0; jest.resetModules(); });
jest.mock('@/lib/db', () => ({ query: jest.fn(), transaction: jest.fn() }));
import * as db from '@/lib/db';
function installFake() {
  const fake = fakeDb();
  (db.query as jest.Mock).mockImplementation((t: string, p: any[] = []) => fake.query(t, p));
  (db.transaction as jest.Mock).mockImplementation(async (fn: any) => {
    // Our transaction helper does BEGIN/COMMIT/ROLLBACK; the fake ignores them.
    return fn(async (t: string, p: any[] = []) => fake.query(t, p));
  });
}

describe('UUID + SKU validation', () => {
  it('isValidPurchaseId rejects arbitrary strings', () => {
    expect(isValidPurchaseId('bogus')).toBe(false);
    expect(isValidPurchaseId(123)).toBe(false);
    expect(isValidPurchaseId('')).toBe(false);
    expect(isValidPurchaseId('00000000-0000-0000-0000-000000000000')).toBe(true);
  });
  it('getReportPurchase returns null (no DB hit) for non-UUID', async () => {
    installFake();
    const q = db.query as jest.Mock;
    const p = await getReportPurchase('bogus');
    expect(p).toBeNull();
    expect(q).not.toHaveBeenCalled();
  });
  it('isValidSkuPair enforces report-${type}', () => {
    expect(isValidSkuPair('transit', 'report-transit')).toBe(true);
    expect(isValidSkuPair('transit', 'report-fullcosmic')).toBe(false);
  });
});

describe('webhook paid marking (invariant verification)', () => {
  async function paid() {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    return purchaseId;
  }
  const goodSession = (over: any = {}) => ({
    id: 'cs_1', client_reference_id: 'PID', payment_status: 'paid',
    currency: 'usd', amount_total: 3900,
    payment_intent: { id: 'pi_1', status: 'succeeded' },
    metadata: { kind: 'report', userId: '7', reportType: 'transit', sku: 'report-transit' },
    ...over,
  });

  it('marks paid when all signed invariants match', async () => {
    const id = await paid();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: goodSession({ client_reference_id: id }) });
    expect(r.outcome).toBe('applied');
    expect((await getReportPurchase(id))?.status).toBe('paid');
  });
  it('defers when payment_status is not paid (async/incomplete)', async () => {
    const id = await paid();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: goodSession({ client_reference_id: id, payment_status: 'unpaid', payment_intent: { id: 'pi_1', status: 'processing' } }) });
    expect(r.outcome).toBe('deferred_unpaid');
    expect((await getReportPurchase(id))?.status).toBe('pending');
  });
  it('defers on amount mismatch (discount/tamper)', async () => {
    const id = await paid();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: goodSession({ client_reference_id: id, amount_total: 100 }) });
    expect(r.outcome).toBe('deferred_mismatch');
    expect(r.reason).toContain('amount');
  });
  it('defers on reportType mismatch', async () => {
    const id = await paid();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: goodSession({ client_reference_id: id, metadata: { kind: 'report', userId: '7', reportType: 'fullcosmic', sku: 'report-fullcosmic' } }) });
    expect(r.outcome).toBe('deferred_mismatch');
  });
});

describe('atomic reading creation + consumption (no orphan)', () => {
  async function paidPurchase() {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    await verifyAndMarkReportPurchasePaid({ purchaseId, session: {
      id: 'cs_1', client_reference_id: purchaseId, payment_status: 'paid', currency: 'usd', amount_total: 3900,
      payment_intent: { id: 'pi_1', status: 'succeeded' },
      metadata: { kind: 'report', userId: '7', reportType: 'transit', sku: 'report-transit' },
    }});
    return purchaseId;
  }
  const readingInput = { userId: 7, type: 'report', title: 'T', question: 'q', pricePaid: 39, resultJson: '{}', pipelineStatus: 'queued' };

  it('consumes once: creates exactly one reading, repeat returns same correlation', async () => {
    const id = await paidPurchase();
    const r1 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', reading: readingInput });
    expect(r1.outcome).toBe('consumed');
    const r2 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', reading: readingInput });
    expect(r2.outcome).toBe('already_correlated');
    expect(r2.readingId).toBe(r1.readingId);
    // Exactly ONE actionable reading exists (no orphan).
    expect(readings.length).toBe(1);
  });

  it('repeat after a failed dispatch returns the actual (rejected) reading status', async () => {
    const id = await paidPurchase();
    const r1 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', reading: readingInput });
    expect(r1.outcome).toBe('consumed');
    // Simulate n8n dispatch failure: reading marked rejected.
    readings[0].pipeline_status = 'rejected';
    const r2 = await consumeReportPurchase({ purchaseId: id, userId: 7, reportType: 'transit', reading: readingInput });
    expect(r2.outcome).toBe('already_correlated');
    expect(r2.readingStatus).toBe('rejected'); // NOT a fake "queued"
    expect(readings.length).toBe(1); // still only one reading
  });

  it('wrong owner -> wrong_owner without creating a reading', async () => {
    const id = await paidPurchase();
    const r = await consumeReportPurchase({ purchaseId: id, userId: 999, reportType: 'transit', reading: readingInput });
    expect(r.outcome).toBe('wrong_owner');
    expect(readings.length).toBe(0);
  });
  it('unpaid purchase -> not_paid', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    const r = await consumeReportPurchase({ purchaseId, userId: 7, reportType: 'transit', reading: readingInput });
    expect(r.outcome).toBe('not_paid');
  });
});
