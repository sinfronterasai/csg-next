import { query } from '@/lib/db';

export type StaffPaidReportSummary = {
  id: number;
  title: string | null;
  reportType: string;
  status: string;
  createdAt: string;
  attempt: number;
  expectedReportId: string | null;
};

/** Staff-only, deliberately allowlisted view of paid reports for recovery. */
export async function listPaidReportsForRole(): Promise<StaffPaidReportSummary[]> {
  const { rows } = await query(
    `SELECT id, title, created_at, pipeline_status, result
       FROM readings
      WHERE type = 'report'
        AND price_paid IS NOT NULL
        AND price_paid > 0
        AND COALESCE(pipeline_status, result->'pipeline'->>'status', 'unknown') IN
            ('queued', 'processing', 'needs_editor', 'rejected', 'dispatch_failed')
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
      attempt: history.length + 1, expectedReportId,
    }];
  });
}
