import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      params.push(body.display_name);
    }
    if (body.patterns_opt_in !== undefined) {
      updates.push(`patterns_opt_in = $${idx++}`);
      params.push(body.patterns_opt_in);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(Number(decoded.userId));
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update settings' }, { status: 500 });
  }
}
