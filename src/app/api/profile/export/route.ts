import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { listReadingsByType, toPublicReport } from '@/lib/profile/store';

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Expires: '0' };

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: noStore });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: noStore });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401, headers: noStore });

    const charts = await query('SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC', [decoded.userId]);
    // Report callbacks contain internal evidence and quality data. Exports are
    // customer-facing artifacts, so emit reports only through the same explicit
    // public contract used by profile and share surfaces.
    const reports = await listReadingsByType(Number(decoded.userId), 'report');

    return NextResponse.json({
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
      natalCharts: charts.rows,
      reports: reports.map(toPublicReport),
    }, { headers: noStore });
  } catch (err: any) {
    console.error('[profile/export]', err);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500, headers: noStore });
  }
}
