jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn(), getUserById: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({ claimPaidRework: jest.fn(), isValidPurchaseId: (s: string) => /^[0-9a-f-]{36}$/.test(s) }));
jest.mock('@/lib/reportPipeline', () => ({ dispatchReport: jest.fn() }));
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { claimPaidRework } from '@/lib/billing/reportPurchaseStore';
import { dispatchReport } from '@/lib/reportPipeline';
import fs from 'fs';
import path from 'path';

const routePath = path.join(process.cwd(), 'src/app/api/reports/[id]/rework/route.ts');
const reportId = '11111111-1111-4111-8111-111111111111';
const snapshot = { birthData: { original: true }, verifiedFacts: { original: true } };
const call = async (body: any = { expectedReportId: reportId, reason: 'Repair rejected report' }, origin = 'https://example.com') => {
  expect(fs.existsSync(routePath)).toBe(true);
  const { POST } = require('@/app/api/reports/[id]/rework/route');
  return POST(new Request('https://example.com/api/reports/50/rework', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: '50' }) });
};
beforeEach(() => {
  jest.resetAllMocks();
  (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: 'session' }) });
  (verifyToken as jest.Mock).mockReturnValue({ userId: 9, role: 'admin' });
  (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: 'admin' });
  (claimPaidRework as jest.Mock).mockResolvedValue({ outcome: 'claimed', reportId, reportType: 'loveblueprint', ownerId: 7, snapshot });
  (dispatchReport as jest.Mock).mockResolvedValue({ ok: true });
});
it('requires an authenticated session before touching entitlement or dispatch', async () => {
  (cookies as jest.Mock).mockResolvedValue({ get: () => undefined });
  expect((await call()).status).toBe(401);
  expect(claimPaidRework).not.toHaveBeenCalled();
  expect(dispatchReport).not.toHaveBeenCalled();
});
it('uses the current database role, not a forged/stale JWT role', async () => {
  (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: 'customer' });
  expect((await call()).status).toBe(403);
  expect(claimPaidRework).not.toHaveBeenCalled();
});
it.each(['admin', 'editor'])('allows %s to rework a customer-owned paid report using only the locked snapshot', async (role) => {
  (getUserById as jest.Mock).mockResolvedValue({ id: 9, role });
  const res = await call();
  expect(res.status).toBe(200);
  expect(claimPaidRework).toHaveBeenCalledWith(expect.objectContaining({ actorId: 9, expectedReportId: reportId, readingId: 50 }));
  expect(dispatchReport).toHaveBeenCalledWith(expect.objectContaining({ birthData: snapshot.birthData, verifiedFacts: snapshot.verifiedFacts, tier: 'paid' }));
  expect(await res.json()).not.toHaveProperty('snapshot');
});
it('rejects cross-origin session requests', async () => {
  expect((await call(undefined, 'https://evil.example')).status).toBe(403);
  expect(claimPaidRework).not.toHaveBeenCalled();
});
it.each(['conflict', 'missing_snapshot', 'invalid_snapshot', 'not_entitled'])('does not dispatch a failed claim: %s', async (outcome) => {
  (claimPaidRework as jest.Mock).mockResolvedValue({ outcome });
  expect((await call()).status).toBe(outcome === 'not_entitled' ? 402 : 409);
  expect(dispatchReport).not.toHaveBeenCalled();
});
it('rejects client snapshot/evidence/owner overrides', async () => {
  expect((await call({ expectedReportId: reportId, reason: 'repair', snapshot, ownerId: 7 })).status).toBe(400);
  expect(claimPaidRework).not.toHaveBeenCalled();
});
it('keeps ambiguous dispatch failure queued and does not leak errors', async () => {
  (dispatchReport as jest.Mock).mockRejectedValue(new Error('private bearer value'));
  const res = await call();
  expect(res.status).toBe(502);
  expect(JSON.stringify(await res.json())).not.toContain('private bearer');
  expect(claimPaidRework).toHaveBeenCalledTimes(1);
});
