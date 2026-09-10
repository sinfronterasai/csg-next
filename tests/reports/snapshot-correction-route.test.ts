jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn(), getUserById: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  isValidPurchaseId: (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v),
  previewPaidSnapshotCorrection: jest.fn(), approvePaidSnapshotCorrection: jest.fn(),
}));
jest.mock('@/lib/reportPipeline', () => ({ dispatchReport: jest.fn() }));
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { previewPaidSnapshotCorrection, approvePaidSnapshotCorrection } from '@/lib/billing/reportPurchaseStore';
import { dispatchReport } from '@/lib/reportPipeline';

const oldId = '6deeb156-4f6d-40e2-988d-a714ff966c39';
const digest = 'a'.repeat(64);
const snapshot = { birthData: { dob: '1990-01-01', birthTime: '12:00', place: 'Santa Cruz Ca', lat: 36.97412, lon: -122.0308, tz: 'America/Los_Angeles', solarFallback: false }, verifiedFacts: { schemaVersion: 'csg-report-facts-v2' } };
const call = async (body: unknown) => {
  const { POST } = require('@/app/api/reports/[id]/correction/route');
  return POST(new Request('https://example.com/api/reports/1160/correction', { method: 'POST', headers: { origin: 'https://example.com' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: '1160' }) });
};
beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: 'session' }) });
  (verifyToken as jest.Mock).mockReturnValue({ userId: '9' });
  (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: 'admin' });
  (previewPaidSnapshotCorrection as jest.Mock).mockResolvedValue({ outcome: 'preview', oldReportId: oldId, digest, snapshot });
  (approvePaidSnapshotCorrection as jest.Mock).mockResolvedValue({ outcome: 'claimed', reportId: '11111111-1111-4111-8111-111111111111', reportType: 'loveblueprint', snapshot });
  (dispatchReport as jest.Mock).mockResolvedValue({ ok: true });
});
it('returns a server-built preview digest without mutating or dispatching', async () => {
  const res = await call({ action: 'preview', expectedReportId: oldId });
  expect(res.status).toBe(200);
  expect((await res.json()).digest).toBe(digest);
  expect(approvePaidSnapshotCorrection).not.toHaveBeenCalled();
  expect(dispatchReport).not.toHaveBeenCalled();
});
it('approves only the exact digest and dispatches the corrected server snapshot', async () => {
  const res = await call({ action: 'approve', expectedReportId: oldId, digest, reason: 'Correct Pacific timezone facts' });
  expect(res.status).toBe(200);
  expect(approvePaidSnapshotCorrection).toHaveBeenCalledWith(expect.objectContaining({ readingId: 1160, expectedReportId: oldId, digest, actorId: 9 }));
  expect(dispatchReport).toHaveBeenCalledWith(expect.objectContaining({ birthData: snapshot.birthData, verifiedFacts: snapshot.verifiedFacts, tier: 'paid' }));
  expect(await res.json()).not.toHaveProperty('snapshot');
});
it('rejects client correction overrides and digest mismatch before approval', async () => {
  expect((await call({ action: 'preview', expectedReportId: oldId, timezone: 'UTC' })).status).toBe(400);
  (approvePaidSnapshotCorrection as jest.Mock).mockResolvedValue({ outcome: 'conflict' });
  expect((await call({ action: 'approve', expectedReportId: oldId, digest: 'b'.repeat(64), reason: 'Correct facts' })).status).toBe(409);
  expect(approvePaidSnapshotCorrection).toHaveBeenCalled();
  expect(dispatchReport).not.toHaveBeenCalled();
});
it('keeps the quarantined report unchanged when the correction engine cannot build', async () => {
  (previewPaidSnapshotCorrection as jest.Mock).mockResolvedValue({ outcome: 'missing_snapshot' });
  expect((await call({ action: 'preview', expectedReportId: oldId })).status).toBe(409);
  expect(dispatchReport).not.toHaveBeenCalled();
});
