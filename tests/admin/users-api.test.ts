jest.mock('@/lib/admin/users', () => ({ currentAdminUser: jest.fn(), userAnalytics: jest.fn(), changeUserPassword: jest.fn(), AdminUserError: class extends Error {} }));
import { currentAdminUser, userAnalytics, changeUserPassword } from '@/lib/admin/users';
import { GET } from '@/app/api/admin/users/route';
import { POST } from '@/app/api/admin/users/password/route';

const url = 'https://cosmicspiritguide.com/api/admin/users/password';
const valid = { userId: 2, currentPassword: 'admin-current', newPassword: 'customer-password-123', reason: 'Requested by customer' };
const post = (body: unknown = valid, origin: string | null = 'https://cosmicspiritguide.com') => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
beforeEach(() => { jest.resetAllMocks(); (currentAdminUser as jest.Mock).mockResolvedValue({ id: 1, role: 'admin' }); });

it.each([null, { id: 1, role: 'user' }, { id: 1, role: 'editor' }])('protects both APIs for %j', async (user) => {
  (currentAdminUser as jest.Mock).mockResolvedValue(user);
  const expected = user ? 403 : 401;
  expect((await GET(new Request('https://cosmicspiritguide.com/api/admin/users'))).status).toBe(expected);
  expect((await POST(post())).status).toBe(expected);
  expect(userAnalytics).not.toHaveBeenCalled(); expect(changeUserPassword).not.toHaveBeenCalled();
});
it.each([null, 'https://evil.example'])('rejects missing/foreign origin %s', async (origin) => {
  expect((await POST(post(valid, origin))).status).toBe(403);
  expect(changeUserPassword).not.toHaveBeenCalled();
});
it.each([{ ...valid, userId: "2 OR 1=1" }, { ...valid, newPassword: 'short' }, { ...valid, newPassword: '🔑'.repeat(20) }, { ...valid, reason: '' }, { ...valid, currentPassword: '' }])('validates password mutation input %j', async (body) => {
  expect((await POST(post(body))).status).toBe(400); expect(changeUserPassword).not.toHaveBeenCalled();
});
it('passes only validated changes to the service and never returns credentials', async () => {
  const response = await POST(post());
  expect(response.status).toBe(200);
  expect(changeUserPassword).toHaveBeenCalledWith('1', '2', valid.currentPassword, valid.newPassword, valid.reason);
  expect(await response.json()).toEqual({ success: true });
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('bounds pagination and makes user data private', async () => {
  (userAnalytics as jest.Mock).mockResolvedValue({ users: [], total: 0 });
  const response = await GET(new Request('https://cosmicspiritguide.com/api/admin/users?page=-2&search=alice'));
  expect(userAnalytics).toHaveBeenCalledWith('alice', 1);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
