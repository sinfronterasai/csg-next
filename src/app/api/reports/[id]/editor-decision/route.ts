import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReadingById } from '@/lib/profile/store';
import { sendEditorDecision } from '@/lib/reportPipeline';

// PATCH /api/reports/:id/editor-decision
// Internal editorial sign-off for PAID reports in `needs_editor`. Posts the final
// approved/rejected decision to n8n, which calls back to /api/reports/pipeline-complete
// to apply the terminal status. Auth + ownership required; this is not customer-facing.
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
    const rec = await getReadingById(readingId, Number(decoded.userId));
    if (!rec || rec.type !== 'report') {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
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
