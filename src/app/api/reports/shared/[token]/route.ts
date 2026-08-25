import { NextResponse } from 'next/server';
import { getReadingByShareToken, toPublicReport } from '@/lib/profile/store';

// GET /api/reports/shared/:token  (public, no auth)
// Returns the shared report payload for rendering the public read-only page.
// Pipeline reports are gated: a paid report awaiting editor sign-off or a
// rejected report is never delivered (R3.5).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rec = await getReadingByShareToken(token);
    if (!rec || rec.type !== 'report') {
      return NextResponse.json({ error: 'Shared report not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...toPublicReport(rec) });
  } catch {
    return NextResponse.json({ error: 'Failed to load shared report' }, { status: 500 });
  }
}
