const mockStripeCreate = jest.fn();
const mockQuery = jest.fn();
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockStripeCreate } },
  })),
}));
jest.mock('@/lib/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));
jest.mock('@/lib/billing/reportPurchaseStore', () => {
  class ReportCheckoutConflictError extends Error {
    constructor(public purchase: any) { super('conflict'); }
  }
  return {
    ReportCheckoutConflictError,
    createReportPurchase: jest.fn(),
    verifyAndMarkReportPurchasePaid: jest.fn(),
    getReportPurchase: jest.fn(),
  };
});

import { createReportCheckoutSession } from '@/lib/billing/reportPurchase';

const store = require('@/lib/billing/reportPurchaseStore');

describe('interrupted checkout recovery', () => {
  beforeAll(() => { process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'; });
  beforeEach(() => {
    jest.clearAllMocks();
    const pending = {
      purchaseId: '11111111-1111-1111-1111-111111111111', status: 'pending',
      stripeSessionId: null, userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint',
    };
    store.createReportPurchase.mockRejectedValue(new store.ReportCheckoutConflictError(pending));
    mockStripeCreate.mockResolvedValue({ id: 'cs_same', url: 'https://checkout.stripe.com/c/pay/same' });
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('resumes the pending purchase with a deterministic Stripe idempotency key', async () => {
    const result = await createReportCheckoutSession({
      userId: 123, reportType: 'loveblueprint', email: 'buyer@example.com',
    });
    expect(result).toEqual(expect.objectContaining({
      purchaseId: '11111111-1111-1111-1111-111111111111', sessionId: 'cs_same',
      url: 'https://checkout.stripe.com/c/pay/same',
    }));
    expect(mockStripeCreate).toHaveBeenCalledTimes(1);
    expect(mockStripeCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: 'report-checkout-11111111-1111-1111-1111-111111111111',
    });
  });
});
