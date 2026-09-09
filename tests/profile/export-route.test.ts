import { GET } from '@/app/api/profile/export/route';

const query = jest.fn();
const listReadingsByType = jest.fn();
const toPublicReport = jest.fn();

jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: () => ({ value: 'token' }) }) }));
jest.mock('@/lib/auth', () => ({ verifyToken: () => ({ userId: '7' }), getUserById: async () => ({ id: 7, email: 'a@example.com', first_name: 'A', last_name: 'B' }) }));
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => query(...args) }));
jest.mock('@/lib/profile/store', () => ({
  listReadingsByType: (...args: unknown[]) => listReadingsByType(...args),
  toPublicReport: (...args: unknown[]) => toPublicReport(...args),
}));

describe('profile export report sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [{ id: 1, timezone: 'America/Chicago' }] });
    listReadingsByType.mockResolvedValue([{ id: 22, result: { pipeline: { judge: { secret: 'internal' } } } }]);
    toPublicReport.mockReturnValue({ id: 22, status: 'approved', sections: [{ id: 'core', prose: 'Public prose' }] });
  });

  it('exports report data only through the public contract, not raw callback payloads', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toEqual([{ id: 22, status: 'approved', sections: [{ id: 'core', prose: 'Public prose' }] }]);
    expect(JSON.stringify(body)).not.toContain('internal');
    expect(listReadingsByType).toHaveBeenCalledWith(7, 'report');
    expect(toPublicReport).toHaveBeenCalledTimes(1);
  });
});
