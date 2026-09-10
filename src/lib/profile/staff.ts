import { query } from '@/lib/db';

export type StaffActionReasonCode =
  | 'audit_only' | 'editor_review_required' | 'failure_evidence_required'
  | 'authenticated_failure' | 'dispatch_failed' | 'pipeline_error'
  | 'rejected_with_snapshot' | 'snapshot_missing' | 'correction_not_verified'
  | 'known_invalid_signature' | 'unsupported_status';

export type StaffActionEligibility = { enabled: boolean; reasonCode: StaffActionReasonCode };

export type StaffPaidReportSummary = {
  id: number;
  title: string | null;
  reportType: string;
  status: string;
  createdAt: string;
  attempt: number;
  expectedReportId: string | null;
  actions: { correction: StaffActionEligibility; rework: StaffActionEligibility };
};

const KNOWN_INVALID_REPORT_ID = '6deeb156-4f6d-40e2-988d-a714ff966c39';

/** Pure, safe classification. It returns reason codes, never judge prose or facts. */
export function classifyPaidReportActions(status: string, result: any): StaffPaidReportSummary['actions'] {
  const snapshotPresent = Boolean(result?.metadata?.birthData && result?.metadata?.verifiedFacts);
  const knownInvalid = result?.reportId === KNOWN_INVALID_REPORT_ID && (() => {
    const b = result?.metadata?.birthData;
    return b?.dob === '1980-03-09' && /^(?:16:21|16:21:00)$/.test(String(b?.birthTime ?? '')) &&
      typeof b?.place === 'string' && /santa\s+cruz/i.test(b.place) && Number(b.lat) === 36.97412 &&
      Number(b.lon) === -122.0308 && b.tz === 'UTC';
  })();
  const correction = status === 'queued' || status === 'processing'
    ? (knownInvalid ? { enabled: true, reasonCode: 'known_invalid_signature' as const } : { enabled: false, reasonCode: 'correction_not_verified' as const })
    : { enabled: false, reasonCode: status === 'approved' ? 'audit_only' as const : 'correction_not_verified' as const };
  let rework: StaffActionEligibility;
  if (status === 'approved') rework = { enabled: false, reasonCode: 'audit_only' };
  else if (status === 'needs_editor') rework = { enabled: false, reasonCode: 'editor_review_required' };
  else if (!snapshotPresent) rework = { enabled: false, reasonCode: 'snapshot_missing' };
  else if ((status === 'queued' || status === 'processing') && result?.failureEvidence?.source === 'authenticated_pipeline' &&
    result.failureEvidence.reportId === result.reportId && result.failureEvidence.status === 'failed') rework = { enabled: true, reasonCode: 'authenticated_failure' };
  else if (status === 'dispatch_failed') rework = { enabled: true, reasonCode: 'dispatch_failed' };
  else if (status === 'error') rework = { enabled: true, reasonCode: 'pipeline_error' };
  else if (status === 'rejected') rework = { enabled: true, reasonCode: 'rejected_with_snapshot' };
  else if (status === 'queued' || status === 'processing') rework = { enabled: false, reasonCode: 'failure_evidence_required' };
  else rework = { enabled: false, reasonCode: 'unsupported_status' };
  return { correction, rework };
}

/** Staff-only, deliberately allowlisted view of every paid intervention state. */
export async function listPaidReportsForRole(): Promise<StaffPaidReportSummary[]> {
  const { rows } = await query(
    `SELECT id, title, created_at, pipeline_status, result
       FROM readings
      WHERE type = 'report'
        AND price_paid IS NOT NULL
        AND price_paid > 0
        AND COALESCE(pipeline_status, result->'pipeline'->>'status', 'unknown') IN
            ('queued', 'processing', 'needs_editor', 'rejected', 'dispatch_failed', 'error', 'approved')
      ORDER BY created_at DESC
      LIMIT 100`,
  );
  return rows.flatMap((row: any) => {
    const result = typeof row.result === 'string' ? JSON.parse(row.result) : row.result ?? {};
    const reportType = typeof result.reportType === 'string' ? result.reportType : '';
    const expectedReportId = typeof result.reportId === 'string' ? result.reportId : null;
    if (!reportType) return [];
    const status = String(row.pipeline_status ?? result.pipeline?.status ?? 'unknown');
    const history = Array.isArray(result.reworkHistory) ? result.reworkHistory : [];
    return [{
      id: Number(row.id), title: typeof row.title === 'string' ? row.title : null,
      reportType, status, createdAt: new Date(row.created_at).toISOString(),
      attempt: history.length + 1, expectedReportId, actions: classifyPaidReportActions(status, result),
    }];
  });
}
