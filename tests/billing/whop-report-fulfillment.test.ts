import { productForWhopPlan, processWhopPayment } from '@/lib/whop';

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  insertWhopReportPurchase: jest.fn(),
}));

const db = require('@/lib/db') as { query: jest.Mock; transaction: jest.Mock };
const purchaseStore = require('@/lib/billing/reportPurchaseStore') as { insertWhopReportPurchase: jest.Mock };

const REPORT_PLANS = [
  ['plan_oazEpfS5z5Gud', 'natalpremium', 'report-natalpremium', 3900],
  ['plan_CCmKCXfGGPpvo', 'loveblueprint', 'report-loveblueprint', 3900],
  ['plan_yspM7Upl5CsPM', 'transit', 'report-transit', 4900],
  ['plan_H6o8FSjDvpw7Y', 'vocation', 'report-vocation', 5500],
] as const;

function makeTx() {
  return jest.fn(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.includes("SET status = 'refunded'")) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO whop_entitlements')) return { rows: [{ id: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });
  db.transaction.mockImplementation(async (fn: any) => fn(makeTx()));
  purchaseStore.insertWhopReportPurchase.mockResolvedValue({ purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', created: true });
});

describe('Whop paid-report fulfillment', () => {
  test.each(REPORT_PLANS)('maps %s to the canonical report purchase for %s', async (planId, reportType, sku, amount) => {
    expect(productForWhopPlan(planId)?.reportType).toBe(reportType);

    const result = await processWhopPayment({
      eventType: 'payment.succeeded',
      paymentId: `pay-${reportType}`,
      email: 'buyer@example.com',
      planId,
    });

    expect(result.applied).toBe(true);
    expect(result.userId).toBe(42);
    expect(purchaseStore.insertWhopReportPurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      reportType,
      sku,
      amount,
      providerPaymentId: `pay-${reportType}`,
      providerPlanId: planId,
      purchaserEmail: 'buyer@example.com',
      userId: 42,
    }));
  });

  test('does not establish a purchase for an unknown plan', async () => {
    const result = await processWhopPayment({
      eventType: 'payment.succeeded',
      paymentId: 'pay-unknown',
      email: 'buyer@example.com',
      planId: 'plan_unknown',
    });
    expect(result).toEqual({ applied: false, reason: 'unsupported-plan' });
    expect(purchaseStore.insertWhopReportPurchase).not.toHaveBeenCalled();
  });

  test('rejects missing purchaser identity before any mutation', async () => {
    const result = await processWhopPayment({
      eventType: 'payment.succeeded',
      paymentId: 'pay-missing-email',
      email: '',
      planId: 'plan_oazEpfS5z5Gud',
    });
    expect(result.reason).toBe('missing-email');
    expect(db.transaction).not.toHaveBeenCalled();
    expect(purchaseStore.insertWhopReportPurchase).not.toHaveBeenCalled();
  });

  test('revokes a refunded report purchase without deleting the report', async () => {
    const tx = makeTx();
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));
    const result = await processWhopPayment({
      eventType: 'refund.created',
      paymentId: 'pay-refund',
      email: 'buyer@example.com',
      planId: 'plan_CCmKCXfGGPpvo',
    });
    expect(result.applied).toBe(true);
    expect(tx.mock.calls.some(([sql]) => String(sql).includes("SET status = 'refunded'"))).toBe(true);
    expect(purchaseStore.insertWhopReportPurchase).not.toHaveBeenCalled();
  });
});
