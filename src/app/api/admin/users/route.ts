import { NextResponse } from 'next/server';
import { currentAdminUser, userAnalytics } from '@/lib/admin/users';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    const user = await currentAdminUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim().slice(0, 150);
    const page = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get('page')) || 1)));
    return NextResponse.json(await userAnalytics(search, page), { headers });
  } catch {
    console.error('[admin/users] listing failed');
    return NextResponse.json({ error: 'Unable to load users right now.' }, { status: 500, headers });
  }
}
