jest.mock('@/lib/db', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({ recordPipelineFailure: jest.fn() }));
import { recordPipelineFailure } from '@/lib/billing/reportPurchaseStore';
import fs from 'fs';
import path from 'path';
const evidence = { reportId: '11111111-1111-4111-8111-111111111111', executionId: '219', failedNode: 'Build Revision Prompt', failedAt: '2026-09-09T12:00:00.000Z', status: 'failed' };
const call = async (token = 'test-server-only', body = JSON.stringify(evidence)) => {
  expect(fs.existsSync(path.join(process.cwd(), 'src/app/api/reports/pipeline-failed/route.ts'))).toBe(true);
  return require('@/app/api/reports/pipeline-failed/route').POST(new Request('https://example.com/api/reports/pipeline-failed', {
    method: 'POST', headers: { authorization: `Bearer ${token}` }, body,
  }));
};
beforeEach(() => { process.env.REPORT_CALLBACK_TOKEN = 'test-server-only'; jest.clearAllMocks(); (recordPipelineFailure as jest.Mock).mockResolvedValue('applied'); });
afterAll(() => { delete process.env.REPORT_CALLBACK_TOKEN; });
it.each(['', 'wrong', 'test-server-only-extra'])('rejects invalid pipeline authentication %s', async (token) => {
  expect((await call(token)).status).toBe(401);
  expect(recordPipelineFailure).not.toHaveBeenCalled();
});
it('fails closed when callback secret is unconfigured', async () => {
  delete process.env.REPORT_CALLBACK_TOKEN;
  expect((await call()).status).toBe(401);
});
it('accepts evidence only through the server-authenticated failure reporter', async () => {
  expect((await call()).status).toBe(200);
  expect(recordPipelineFailure).toHaveBeenCalledWith(evidence);
});
it.each([['duplicate',200],['conflict',409],['not_found',404],['invalid',400]])('maps %s safely', async (outcome, status) => {
  (recordPipelineFailure as jest.Mock).mockResolvedValue(outcome);
  expect((await call()).status).toBe(status);
});
it('rejects oversized or malformed evidence', async () => {
  expect((await call(undefined, 'a'.repeat(2049))).status).toBe(413);
  expect((await call(undefined, '{')).status).toBe(400);
  expect(recordPipelineFailure).not.toHaveBeenCalled();
});
