// Route-level tests for PATCH /api/reports/[id]/editor-decision (R3 / #5).
// Verifies an editor can act on a CUSTOMER-owned report (cross-owner staff
// lookup), and that the status/tier guards hold.
import { PATCH } from '@/app/api/reports/[id]/editor-decision/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
let currentRole = 'editor';
jest.mock('@/lib/auth', () => ({
  verifyToken: () => ({ userId: 'editor-1' }),
  getUserById: async () => ({ id: 'editor-1', role: currentRole }),
}));
jest.mock('@/lib/reportEntitlement', () => ({
  isPaidReport: (t: string) => t === 'fullcosmic' || t === 'transit',
}));

let getReportByIdForRole: jest.Mock;
let sendEditorDecision: jest.Mock;

jest.mock('@/lib/profile/store', () => ({
  getReportByIdForRole: (...a: any[]) => getReportByIdForRole(...a),
}));
jest.mock('@/lib/reportPipeline', () => ({
  sendEditorDecision: (...a: any[]) => sendEditorDecision(...a),
}));

function makeRec(over: any = {}) {
  return {
    id: 5, type: 'report', userId: 999, // owned by a DIFFERENT customer
    result: { reportId: 'rid-z', reportType: 'fullcosmic' },
    pipelineStatus: 'needs_editor', ...over,
  };
}

function call(id: string, body: any) {
  return PATCH(
    new Request(`http://localhost/api/reports/${id}/editor-decision`, {
      method: 'PATCH',
      headers: { 'content-length': String(JSON.stringify(body).length) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  getReportByIdForRole = jest.fn();
  sendEditorDecision = jest.fn(async () => ({ ok: true, status: 200 }));
});

describe('#5 editor cross-owner flow', () => {
  it('staff lookup finds a customer-owned report (no owner filter)', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    const res = await call('5', { decision: 'approved' });
    expect(res.status).toBe(200);
    expect(getReportByIdForRole).toHaveBeenCalledWith(5); // by id only
    expect(sendEditorDecision).toHaveBeenCalledTimes(1);
  });

  it('non-editor/non-admin is forbidden (403)', async () => {
    currentRole = 'customer';
    getReportByIdForRole.mockResolvedValue(makeRec());
    const res = await call('5', { decision: 'approved' });
    expect(res.status).toBe(403);
    currentRole = 'editor'; // restore for later tests
  });

  it('requires current status needs_editor (409 otherwise)', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec({ pipelineStatus: 'approved' }));
    const res = await call('5', { decision: 'approved' });
    expect(res.status).toBe(409);
    expect(sendEditorDecision).not.toHaveBeenCalled();
  });

  it('free report not requiring editorial decision -> 409', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec({ result: { reportId: 'r', reportType: 'natal' } }));
    const res = await call('5', { decision: 'approved' });
    expect(res.status).toBe(409);
  });

  it('report not found -> 404', async () => {
    getReportByIdForRole.mockResolvedValue(null);
    const res = await call('5', { decision: 'approved' });
    expect(res.status).toBe(404);
  });

  it('invalid decision -> 400', async () => {
    getReportByIdForRole.mockResolvedValue(makeRec());
    const res = await call('5', { decision: 'maybe' });
    expect(res.status).toBe(400);
  });
});
