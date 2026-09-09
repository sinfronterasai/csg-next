import { computeVerifiedCommon } from '@/lib/reportFacts/derived';
import { computeChart } from '@/lib/chartEngine';
jest.mock('@/lib/chartEngine', () => ({ ...jest.requireActual('@/lib/chartEngine'), computeChart: jest.fn(async () => { throw new Error('captured engine boundary'); }) }));
it('passes saved coordinates and timezone through the ledger calculation boundary', async () => {
  const birth = { date: '1980-03-09', time: '16:21', location: 'Historical label', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' };
  await expect(computeVerifiedCommon(birth)).rejects.toThrow('captured engine boundary');
  expect(computeChart).toHaveBeenCalledWith(expect.objectContaining(birth));
});
