import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation required', message: 'Send { confirm: "DELETE" }' }, { status: 400 });
    }

    const uid = Number(decoded.userId);
    await query('DELETE FROM readings WHERE user_id = $1', [uid]);
    await query('DELETE FROM natal_charts WHERE user_id = $1', [uid]);
    await query('DELETE FROM users WHERE id = $1', [uid]);

    const res = NextResponse.json({ success: true });
    res.cookies.set('auth_token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete account' }, { status: 500 });
  }
}
