import { classifyPaidReportActions } from '@/lib/profile/staff';

const base = { reportId: '11111111-1111-4111-8111-111111111111', metadata: { birthData: { dob: '1990-01-01' }, verifiedFacts: { asOfDate: '2026-01-01' } } };

it.each(['approved', 'needs_editor'])('locks %s without mutation actions', (status) => {
  expect(classifyPaidReportActions(status, base)).toEqual({
    correction: { enabled: false, reasonCode: status === 'approved' ? 'audit_only' : 'correction_not_verified' },
    rework: { enabled: false, reasonCode: status === 'approved' ? 'audit_only' : 'editor_review_required' },
  });
});

it.each(['queued', 'processing'])('locks %s without authenticated failure evidence', (status) => {
  expect(classifyPaidReportActions(status, base).rework).toEqual({ enabled: false, reasonCode: 'failure_evidence_required' });
});

it('offers rework for evidenced queued failures and terminal paid failures with a valid snapshot', () => {
  expect(classifyPaidReportActions('queued', { ...base, failureEvidence: { source: 'authenticated_pipeline', reportId: base.reportId, status: 'failed' } }).rework)
    .toEqual({ enabled: true, reasonCode: 'authenticated_failure' });
  expect(classifyPaidReportActions('dispatch_failed', base).rework).toEqual({ enabled: true, reasonCode: 'dispatch_failed' });
  expect(classifyPaidReportActions('error', base).rework).toEqual({ enabled: true, reasonCode: 'pipeline_error' });
  expect(classifyPaidReportActions('rejected', base).rework).toEqual({ enabled: true, reasonCode: 'rejected_with_snapshot' });
});

it('offers audited correction only for the exact known-invalid signature', () => {
  const signature = { reportId: '6deeb156-4f6d-40e2-988d-a714ff966c39', metadata: { birthData: { dob: '1980-03-09', birthTime: '16:21:00', place: 'Santa Cruz, CA', lat: 36.97412, lon: -122.0308, tz: 'UTC' }, verifiedFacts: { asOfDate: '2026-01-01' } } };
  expect(classifyPaidReportActions('processing', signature).correction).toEqual({ enabled: true, reasonCode: 'known_invalid_signature' });
  expect(classifyPaidReportActions('processing', { ...signature, reportId: base.reportId }).correction).toEqual({ enabled: false, reasonCode: 'correction_not_verified' });
});

it('does not offer rework without an immutable snapshot', () => {
  expect(classifyPaidReportActions('dispatch_failed', { reportId: base.reportId }).rework).toEqual({ enabled: false, reasonCode: 'snapshot_missing' });
});
