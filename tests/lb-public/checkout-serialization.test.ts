jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

import { transaction } from '@/lib/db';
import { createReportPurchase, ReportCheckoutConflictError } from '@/lib/billing/reportPurchaseStore';

const transactionMock = transaction as jest.Mock;

describe('report checkout claim serialization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('takes a database advisory lock and refuses a second active purchase', async () => {
    let active: any = null;
    const sql: string[] = [];
    transactionMock.mockImplementation(async (callback: any) => callback(async (text: string, params?: any[]) => {
      sql.push(text);
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: null };
      if (text.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (text.startsWith("UPDATE report_orders SET status = 'failed'")) return { rows: [], rowCount: 0 };
      if (text.includes('FROM report_orders') && text.includes("status IN ('pending', 'paid', 'consumed')")) {
        return { rows: active ? [active] : [], rowCount: active ? 1 : 0 };
      }
      if (text.startsWith('INSERT INTO report_orders')) {
        active = {
          id: 1, purchase_id: '11111111-1111-1111-1111-111111111111', user_id: 123,
          report_type: 'loveblueprint', sku: 'report-loveblueprint', amount: 3900,
          currency: 'usd', status: 'pending', stripe_session_id: null,
          stripe_payment_id: null, reading_id: null, report_id: null,
          created_at: new Date(), updated_at: new Date(),
        };
        return { rows: [active], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    }));

    await expect(createReportPurchase({ userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', amount: 3900 }))
      .resolves.toEqual({ purchaseId: '11111111-1111-1111-1111-111111111111' });
    await expect(createReportPurchase({ userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', amount: 3900 }))
      .rejects.toBeInstanceOf(ReportCheckoutConflictError);

    expect(sql.filter((text) => text.includes('pg_advisory_xact_lock'))).toHaveLength(2);
    expect(sql.some((text) => text.includes("status = 'failed'") && text.includes("INTERVAL '25 hours'"))).toBe(true);
    expect(sql.filter((text) => text.startsWith('INSERT INTO report_orders'))).toHaveLength(1);
  });
});
