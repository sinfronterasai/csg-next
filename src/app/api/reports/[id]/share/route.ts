import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { mintShareToken } from '@/lib/profile/store';

// POST /api/reports/:id/share
// Opt a report into public sharing. Returns the unguessable share token.
// Auth required: you can only share your own reading.
export async function POST(
  _request: Request,
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

    const readingId = Number(id);
    if (!Number.isFinite(readingId)) {
      return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    }

    const shareToken = await mintShareToken(readingId, Number(decoded.userId));
    if (!shareToken) {
      return NextResponse.json({ error: 'Report not found or not owned by you' }, { status: 404 });
    }

    return NextResponse.json({ success: true, shareToken });
  } catch {
    return NextResponse.json({ error: 'Failed to share report' }, { status: 500 });
  }
}
