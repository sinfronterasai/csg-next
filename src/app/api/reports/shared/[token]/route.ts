import { NextResponse } from 'next/server';
import { getReadingByShareToken } from '@/lib/profile/store';

// GET /api/reports/shared/:token  (public, no auth)
// Returns the shared report payload for rendering the public read-only page.
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
    const result = rec.result as {
      title?: string; overview?: unknown[]; sections?: unknown[]; reportType?: string;
    };
    return NextResponse.json({
      success: true,
      title: result.title ?? rec.title,
      type: result.reportType,
      overview: result.overview ?? [],
      sections: result.sections ?? [],
      createdAt: rec.createdAt,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load shared report' }, { status: 500 });
  }
}
