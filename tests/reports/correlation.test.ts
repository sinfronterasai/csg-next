// Correlation + retry review tests: single reportId everywhere (r1), required
// Stripe invariants (r5), atomic retry claim (r3), retry only terminal states (r2),
// immutable snapshot on retry (r4).
import {
  consumeReportPurchase, getReportPurchase, claimRetry, markReadingDispatchFailed,
  verifyAndMarkReportPurchasePaid, createReportPurchase,
} from '@/lib/billing/reportPurchaseStore';

const orders: any[] = [];
const readings: any[] = [];

function fakeDb() {
  return {
    async query(text: string, params: any[] = []) {
      if (text.startsWith('INSERT INTO report_orders')) {
        const row = {
          id: orders.length + 1,
          purchase_id: '00000000-0000-0000-0000-' + String(orders.length + 1).padStart(12, '0'),
          user_id: params[0], report_type: params[1], sku: params[2],
          amount: params[3], currency: params[4] ?? 'usd', status: 'pending',
          stripe_session_id: null, stripe_payment_id: null,
          reading_id: null, report_id: null, created_at: new Date(), updated_at: new Date(),
        };
        orders.push(row);
        return { rows: [{ purchase_id: row.purchase_id }], rowCount: 1 };
      }
      if (text.includes("SET status = 'paid'")) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        if (r && (r.status === 'pending' || r.status === 'paid')) {
          r.status = 'paid';
          r.stripe_session_id = params[1] ?? r.stripe_session_id;
          r.stripe_payment_id = params[2] ?? r.stripe_payment_id;
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FOR UPDATE') && text.includes('report_orders')) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      if (text.startsWith('INSERT INTO readings')) {
        const row = {
          id: readings.length + 1, user_id: params[0], type: params[1], title: params[2],
          pipeline_status: params[5], result: JSON.parse(params[4]),
        };
        readings.push(row);
        return { rows: [{ id: row.id, result: params[4] }], rowCount: 1 };
      }
      if (text.includes("SET status = 'consumed'")) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        if (r && r.status === 'paid' && r.reading_id == null) {
          r.status = 'consumed'; r.reading_id = params[1]; r.report_id = params[2];
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('UPDATE readings') && text.includes('pipeline_status')) {
        const r = readings.find((x) => x.id === Number(params[0]));
        if (!r) return { rows: [], rowCount: 0 };
        if (text.includes("SET pipeline_status = 'queued'")) {
          // claimRetry: only a terminal dispatch_failed reading transitions to queued.
          if (r.pipeline_status === 'dispatch_failed') {
            r.pipeline_status = 'queued';
            return { rows: [{ id: r.id }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (text.includes("SET pipeline_status = 'dispatch_failed'")) {
          r.pipeline_status = 'dispatch_failed';
          return { rows: [{ id: r.id }], rowCount: 1 };
        }
        r.pipeline_status = params[1];
        return { rows: [{ id: r.id }], rowCount: 1 };
      }
      if (text.includes('SELECT result FROM readings')) {
        const r = readings.find((x) => x.id === Number(params[0]));
        return { rows: r ? [{ result: r.result }] : [], rowCount: r ? 1 : 0 };
      }
      if (text.includes('SELECT pipeline_status FROM readings')) {
        const r = readings.find((x) => x.id === Number(params[0]));
        return { rows: r ? [{ pipeline_status: r.pipeline_status }] : [], rowCount: r ? 1 : 0 };
      }
      if (text.includes('SELECT * FROM report_orders')) {
        const r = orders.find((x) => x.purchase_id === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      if (text.includes('LEFT JOIN readings')) {
        // Lost-race re-read: must join readings for the status, NOT read a
        // nonexistent report_orders.pipeline_status column.
        if (text.includes('pipeline_status FROM report_orders')) {
          throw new Error('REGRESSION: report_orders has no pipeline_status column');
        }
        const o = orders.find((x) => x.purchase_id === params[0]);
        if (!o || o.reading_id == null) return { rows: [], rowCount: 0 };
        const r = readings.find((x) => x.id === Number(o.reading_id));
        return { rows: [{ reading_id: o.reading_id, report_id: o.report_id, pipeline_status: r?.pipeline_status ?? 'queued' }], rowCount: 1 };
      }
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
  (db.transaction as jest.Mock).mockImplementation(async (fn: any) =>
    fn(async (t: string, p: any[] = []) => fake.query(t, p)),
  );
}

const readingInput = (reportId: string) => ({
  userId: 7, type: 'report', title: 'T', question: 'q', pricePaid: 39,
  resultJson: JSON.stringify({ title: 'T', reportType: 'transit', reportId, verifiedFacts: { x: 1 } }),
  pipelineStatus: 'queued',
});

describe('r1 — correlation is byte-identical across all locations', () => {
  it('report_orders.report_id === reading.result.reportId === dispatch reportId', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    await verifyAndMarkReportPurchasePaid({ purchaseId, session: {
      id: 'cs_1', client_reference_id: purchaseId, payment_status: 'paid', currency: 'usd', amount_total: 3900,
      payment_intent: { id: 'pi_1', status: 'succeeded' },
      metadata: { kind: 'report', userId: '7', reportType: 'transit', sku: 'report-transit' },
    }});
    const reportId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const consumed = await consumeReportPurchase({ purchaseId, userId: 7, reportType: 'transit', reportId, reading: readingInput(reportId) });
    expect(consumed.outcome).toBe('consumed');
    // The single reportId is stored identically in report_orders AND the reading result.
    const order = await getReportPurchase(purchaseId);
    expect(order?.reportId).toBe(reportId);
    const reading = readings.find((r) => r.id === consumed.readingId);
    expect(reading.result.reportId).toBe(reportId);
    expect(order?.reportId).toBe(reading.result.reportId);
    // Callback lookup (by result->>'reportId') would resolve to this reading.
    const callbackLookup = readings.find((r) => r.result.reportId === reportId);
    expect(callbackLookup?.id).toBe(consumed.readingId);
  });
});

describe('r5 — Stripe invariants are REQUIRED', () => {
  async function paidPurchase() {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    return purchaseId;
  }
  const good = (over: any = {}) => ({
    id: 'cs_1', client_reference_id: 'PID', payment_status: 'paid', currency: 'usd', amount_total: 3900,
    payment_intent: { id: 'pi_1', status: 'succeeded' },
    metadata: { kind: 'report', userId: '7', reportType: 'transit', sku: 'report-transit' }, ...over,
  });
  it('missing currency -> mismatch', async () => {
    const id = await paidPurchase();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: good({ client_reference_id: id, currency: undefined }) });
    expect(r.outcome).toBe('deferred_mismatch');
    expect((r as any).reason).toContain('currency');
  });
  it('zero amount -> mismatch', async () => {
    const id = await paidPurchase();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: good({ client_reference_id: id, amount_total: 0 }) });
    expect(r.outcome).toBe('deferred_mismatch');
    expect((r as any).reason).toContain('amount');
  });
  it('NaN amount -> mismatch', async () => {
    const id = await paidPurchase();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: good({ client_reference_id: id, amount_total: 'abc' }) });
    expect(r.outcome).toBe('deferred_mismatch');
  });
  it('missing session id -> mismatch', async () => {
    const id = await paidPurchase();
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: good({ client_reference_id: id, id: undefined }) });
    expect(r.outcome).toBe('deferred_mismatch');
    expect((r as any).reason).toContain('session_id');
  });
  it('recorded session id mismatch -> mismatch', async () => {
    const id = await paidPurchase();
    // Seed the recorded session id directly (as if set at checkout time).
    orders[orders.length - 1].stripe_session_id = 'cs_recorded';
    const r = await verifyAndMarkReportPurchasePaid({ purchaseId: id, session: good({ client_reference_id: id, id: 'cs_different' }) });
    expect(r.outcome).toBe('deferred_mismatch');
    expect((r as any).reason).toContain('session_id');
  });
});

describe('r4 — lost-race branch query shape (#4)', () => {
  it('already_consumed returns existing correlation with reading status from JOIN (no report_orders.pipeline_status)', async () => {
    installFake();
    const { purchaseId } = await createReportPurchase({ userId: 7, reportType: 'transit', sku: 'report-transit', amount: 3900 });
    await verifyAndMarkReportPurchasePaid({ purchaseId, session: {
      id: 'cs_1', client_reference_id: purchaseId, payment_status: 'paid', currency: 'usd', amount_total: 3900,
      payment_intent: { id: 'pi_1', status: 'succeeded' },
      metadata: { kind: 'report', userId: '7', reportType: 'transit', sku: 'report-transit' },
    }});
    const reportId = 'bbbbbbbb-0000-0000-0000-000000000001';
    const first = await consumeReportPurchase({ purchaseId, userId: 7, reportType: 'transit', reportId, reading: {
      userId: 7, type: 'report', title: 'T', question: 'q', pricePaid: 39,
      resultJson: JSON.stringify({ reportId, reportType: 'transit', verifiedFacts: { x: 1 } }), pipelineStatus: 'queued',
    }});
    expect(first.outcome).toBe('consumed');
    // Mark the reading as dispatch_failed to prove status comes from readings via JOIN.
    readings.find((r) => r.id === first.readingId)!.pipeline_status = 'dispatch_failed';
    const second = await consumeReportPurchase({ purchaseId, userId: 7, reportType: 'transit', reportId, reading: {
      userId: 7, type: 'report', title: 'T', question: 'q', pricePaid: 39,
      resultJson: JSON.stringify({ reportId, reportType: 'transit', verifiedFacts: { x: 1 } }), pipelineStatus: 'queued',
    }});
    expect(second.outcome).toBe('already_correlated');
    expect(second.readingStatus).toBe('dispatch_failed');
  });
});

describe('r2/r3 — retry claim is atomic, terminal-only, loser 409', () => {
  function makeReading(status: string) {
    readings.push({ id: readings.length + 1, user_id: 7, type: 'report', title: 'T', pipeline_status: status, result: { reportId: 'r1', reportType: 'transit', metadata: { birthData: { dob: '1990-01-01' }, verifiedFacts: { x: 1 } } } });
    return readings.length;
  }
  it('claims a dispatch_failed reading atomically (winner)', async () => {
    installFake();
    const rid = makeReading('dispatch_failed');
    const { claimed } = await claimRetry(rid, 7);
    expect(claimed).toBe(true);
    expect(readings.find((r) => r.id === rid)!.pipeline_status).toBe('queued');
  });
  it('rejects queued (never retryable)', async () => {
    installFake();
    const rid = makeReading('queued');
    const { claimed } = await claimRetry(rid, 7);
    expect(claimed).toBe(false);
  });
  it('two concurrent claims: exactly one wins', async () => {
    installFake();
    const rid = makeReading('dispatch_failed');
    const [a, b] = await Promise.all([claimRetry(rid, 7), claimRetry(rid, 7)]);
    const wins = [a.claimed, b.claimed].filter(Boolean).length;
    expect(wins).toBe(1); // loser gets 409-equivalent false
  });
  it('markReadingDispatchFailed restores terminal state after a failed retry dispatch', async () => {
    installFake();
    const rid = makeReading('queued');
    await markReadingDispatchFailed(rid);
    expect(readings.find((r) => r.id === rid)!.pipeline_status).toBe('dispatch_failed');
  });
});
