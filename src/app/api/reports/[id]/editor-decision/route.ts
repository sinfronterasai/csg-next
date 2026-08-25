import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReportByIdForRole, setReadingDispatchFailed } from '@/lib/profile/store';
import { isPaidReport } from '@/lib/billing/reportPurchase';
import { sendEditorDecision } from '@/lib/reportPipeline';

// R3 editor decision endpoint. Editors/admins act on ANY report (including
// customer-owned), so lookups use the role-aware store, never the owner-filtered one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    // Editor/Admin only.
    if (user.role !== 'editor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reading = await getReportByIdForRole(Number(id));
    if (!reading) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    const reportType = (reading.result as any)?.reportType as string | undefined;
    if (!reportType || !isPaidReport(reportType as any)) {
      return NextResponse.json({ error: 'Only paid reports require editorial sign-off' }, { status: 400 });
    }
    // Only a report awaiting editorial sign-off can be decided.
    if (reading.pipelineStatus !== 'needs_editor') {
      return NextResponse.json(
        { error: 'Report is not awaiting an editor decision', status: reading.pipelineStatus },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { decision, editorNote } = body;
    if (decision !== 'accept' && decision !== 'reject') {
      return NextResponse.json({ error: "decision must be 'accept' or 'reject'" }, { status: 400 });
    }

    try {
      const res = await sendEditorDecision({
        reportId: (reading.result as any).reportId,
        decision,
        editorNote: editorNote ?? '',
        reviewer: user.email ?? String(user.id),
      });
      if (!res.ok) throw new Error(`editor webhook rejected with status ${res.status}`);
    } catch (err: any) {
      console.error('[editor-decision] forward failed:', err?.message);
      return NextResponse.json({ error: 'Editor dispatch failed. Please retry.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, decision });
  } catch (err: any) {
    const msg = err?.message || 'Editor decision failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
