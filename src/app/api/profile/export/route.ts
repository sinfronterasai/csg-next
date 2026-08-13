import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const charts = await query('SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC', [decoded.userId]);
    const readings = await query('SELECT * FROM readings WHERE user_id = $1 ORDER BY created_at DESC', [decoded.userId]);

    return NextResponse.json({
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
      natalCharts: charts.rows,
      readings: readings.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to export data' }, { status: 500 });
  }
}
