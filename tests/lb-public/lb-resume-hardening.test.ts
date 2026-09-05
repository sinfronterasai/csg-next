import { NextRequest } from 'next/server';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: () => ({ value: 'tok' }) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ userId: '123' })),
  getUserById: jest.fn(async () => ({ id: 123, email: 'test@example.com' })),
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchaseBySession: jest.fn(),
}));
jest.mock('@/lib/billing/reportPurchase', () => ({
  verifyPurchasePaidViaStripe: jest.fn(),
}));

const post = require('@/app/api/billing/checkout/resume/route').POST;
const getBySession = require('@/lib/billing/reportPurchaseStore').getReportPurchaseBySession as jest.Mock;
const verifyPaid = require('@/lib/billing/reportPurchase').verifyPurchasePaidViaStripe as jest.Mock;
const validPurchase = {
  purchaseId: 'purchase-1', userId: 123, reportType: 'loveblueprint', sku: 'report-loveblueprint', status: 'paid',
};

const call = (body: string) => post(new NextRequest('http://attacker.invalid/api/billing/checkout/resume', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body,
}));

describe('Love Blueprint resume request hardening', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an oversized body before database or Stripe access', async () => {
    const res = await call(JSON.stringify({ sessionId: `si_${'x'.repeat(50_001)}` }));
    expect(res.status).toBe(413);
    expect(getBySession).not.toHaveBeenCalled();
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('cancels a streaming body as soon as the byte cap is crossed', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(30_000)));
        controller.enqueue(new TextEncoder().encode('x'.repeat(30_001)));
      },
      cancel,
    });
    const request = new NextRequest('http://localhost/api/billing/checkout/resume', {
      method: 'POST', body: stream as any, duplex: 'half',
    } as any);
    const res = await post(request);
    expect(res.status).toBe(413);
    expect(cancel).toHaveBeenCalled();
    expect(getBySession).not.toHaveBeenCalled();
  });

  it('requires the exact Love Blueprint SKU as well as report type', async () => {
    getBySession.mockResolvedValue({ ...validPurchase, sku: 'report-transit' });
    const res = await call(JSON.stringify({ sessionId: 'si_1' }));
    expect(res.status).toBe(403);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('rechecks the exact type and SKU after Stripe verification', async () => {
    getBySession.mockResolvedValue(validPurchase);
    verifyPaid.mockResolvedValue({ ...validPurchase, sku: 'report-transit' });
    const res = await call(JSON.stringify({ sessionId: 'si_1' }));
    expect(res.status).toBe(403);
  });
});
