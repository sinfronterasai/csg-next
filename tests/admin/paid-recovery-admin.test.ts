jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn(), getUserById: jest.fn() }));
jest.mock('@/lib/profile/staff', () => ({ listPaidReportsForRole: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));

import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { listPaidReportsForRole } from '@/lib/profile/staff';

const request = (method = 'GET') => new Request('https://example.com/api/admin/reports', { method });

beforeEach(() => {
  jest.resetAllMocks();
  (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: 'session' }) });
  (headers as jest.Mock).mockResolvedValue({ get: () => 'example.com' });
  (verifyToken as jest.Mock).mockReturnValue({ userId: '9' });
  (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: 'admin' });
  (listPaidReportsForRole as jest.Mock).mockResolvedValue([
    { id: 1162, title: 'Premium Natal Report', reportType: 'natalpremium', status: 'queued', createdAt: '2026-01-02T00:00:00.000Z', attempt: 1 },
  ]);
});

describe('paid recovery admin API', () => {
  it.each(['customer', 'user', ''])('denies %s role without listing reports', async (role) => {
    (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: role || 'user' });
    const { GET } = require('@/app/api/admin/reports/route');
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(listPaidReportsForRole).not.toHaveBeenCalled();
  });

  it('returns only safe paid report summaries for staff', async () => {
    const { GET } = require('@/app/api/admin/reports/route');
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1162, status: 'queued' })]));
    expect(JSON.stringify(body)).not.toMatch(/token|bearer|password|judge|secret|snapshot|verifiedFacts/i);
  });
  it('allows staff listing on the production host while preserving role protection', async () => {
    const { GET } = require('@/app/api/admin/reports/route');
    const res = await GET(new Request('https://cosmicspiritguide.com/api/admin/reports'));
    expect(res.status).toBe(200);
    expect(listPaidReportsForRole).toHaveBeenCalled();
  });
});

describe('admin recovery UI contract', () => {
  it('is protected server-side and renders the recovery workflow', async () => {
    const source = require('fs').readFileSync('src/app/admin/reports/recovery/page.tsx', 'utf8');
    expect(source).toMatch(/getUserById/);
    expect(source).toMatch(/redirect/);
    const view = require('fs').readFileSync('src/app/admin/reports/recovery/RecoveryAdminView.tsx', 'utf8');
    expect(view).toMatch(/Paid report recovery/);
    expect(view).toMatch(/digest above exactly/);
  });

  it('does not render secrets or raw judge prose', () => {
    const source = require('fs').readFileSync('src/app/admin/reports/recovery/RecoveryAdminView.tsx', 'utf8');
    expect(source).not.toMatch(/token|bearer|password|judgeProse|rawJudge|secret/i);
  });

  it('denies the page to ordinary users before rendering the client workflow', async () => {
    (getUserById as jest.Mock).mockResolvedValue({ id: 9, role: 'user' });
    const { PaidRecoveryPage } = { PaidRecoveryPage: require('@/app/admin/reports/recovery/page').default };
    await expect(PaidRecoveryPage()).rejects.toThrow('REDIRECT:/');
  });

  it('requires digest confirmation and a bounded reason before approval', () => {
    const source = require('fs').readFileSync('src/app/admin/reports/recovery/RecoveryAdminView.tsx', 'utf8');
    expect(source).toMatch(/action === 'approve' && !confirmed/);
    expect(source).toMatch(/reason\.trim\(\)\.length < 5/);
    expect(source).toMatch(/action: 'approve'/);
  });

  it('shows the recovery navigation only for staff roles', () => {
    const source = require('fs').readFileSync('src/components/SiteHeader.tsx', 'utf8');
    expect(source).toMatch(/userRole === 'editor' \|\| userRole === 'admin'/);
    expect(source).toMatch(/\/admin\/reports\/recovery/);
  });
});
