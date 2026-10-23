import { GET } from '@/app/api/tarot/relationship-access/route';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
const mockQuery = query as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  (cookies as jest.Mock).mockResolvedValue({get: () => ({value:'valid-token'})});
  (verifyToken as jest.Mock).mockReturnValue({userId:'7'});
});
it('does not query or expose account data to signed-out visitors', async () => {
  (verifyToken as jest.Mock).mockReturnValue(null);
  const res = await GET();
  expect(await res.json()).toEqual({status:'signed_out'});
  expect(mockQuery).not.toHaveBeenCalled();
  expect(res.headers.get('cache-control')).toContain('no-store');
});
it.each([
  [{subscription_tier:'free',unlocked:false}, 'locked'],
  [{subscription_tier:'free',unlocked:true}, 'unlocked'],
  [{subscription_tier:'premium',unlocked:false}, 'unlocked'],
  [{subscription_tier:'premium_plus',unlocked:false}, 'unlocked'],
])('reports authenticated access without granting access from a URL parameter', async (row,status) => {
  mockQuery.mockResolvedValue({rows:[row]});
  expect(await (await GET()).json()).toEqual({status});
  expect(mockQuery.mock.calls[0][1]).toEqual([7]);
});
it('does not steer a buyer to pay again when access cannot be checked', async () => {
  mockQuery.mockRejectedValue(new Error('DB unavailable'));
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({error:expect.any(String)});
});
