import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReportByIdForRole } from '@/lib/profile/store';
import { sendEditorDecision } from '@/lib/reportPipeline';
import { isPaidReport } from '@/lib/reportEntitlement';
import type { ReportType } from '@/lib/reportEngine';

// PATCH /api/reports/:id/editor-decision
// Internal editorial sign-off for PAID reports in `needs_editor`. Posts the final
// approved/rejected decision to n8n, which calls back to /api/reports/pipeline-complete
// to apply the terminal status. Role-authorized; uses a staff lookup (not the
// customer-owned lookup) so an editor can act on any customer's report.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    // Only editors/admins may make editorial decisions.
    if (user.role !== 'editor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const readingId = Number(id);
    if (!Number.isFinite(readingId)) {
      return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    }

    // Staff lookup: by id only, no ownership filter. Safe because role is enforced.
    const rec = await getReportByIdForRole(readingId);
    if (!rec || rec.type !== 'report') {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Only PAID reports require editorial sign-off.
    const reportType = (rec.result as any)?.reportType as ReportType | undefined;
    if (!reportType || !isPaidReport(reportType)) {
      return NextResponse.json({ error: 'Only paid reports require editorial decision' }, { status: 409 });
    }

    // Must currently be awaiting sign-off.
    const pipeline = (rec.result as any)?.pipeline as { status?: string } | undefined;
    const currentStatus = pipeline?.status ?? rec.pipelineStatus ?? null;
    if (currentStatus !== 'needs_editor') {
      return NextResponse.json(
        { error: `Report is not awaiting editorial decision (status: ${currentStatus})` },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const decision = body.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 });
    }

    const reportId = (rec.result as any)?.reportId;
    if (!reportId) {
      return NextResponse.json({ error: 'Report is not in the pipeline' }, { status: 409 });
    }

    const res = await sendEditorDecision({
      reportId,
      decision,
      editorNote: body.editorNote ?? '',
      reviewer: String(user.id),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to forward editorial decision' }, { status: 502 });
    }
    return NextResponse.json({ success: true, decision, forwarded: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Editor decision failed' }, { status: 500 });
  }
}
