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

    const body = await request.json().catch(() => null);
    // Reject null/array payloads (not a non-null object).
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      params.push(typeof body.display_name === 'string' ? body.display_name : null);
    }
    // Persist horoscope_sign (column added in migration.sql).
    if (body.horoscope_sign !== undefined) {
      updates.push(`horoscope_sign = $${idx++}`);
      params.push(typeof body.horoscope_sign === 'string' ? body.horoscope_sign : null);
    }
    // Require an explicit boolean; reject anything else to avoid a DB 500.
    if (body.patterns_opt_in !== undefined) {
      if (typeof body.patterns_opt_in !== 'boolean') {
        return NextResponse.json({ error: 'patterns_opt_in must be a boolean' }, { status: 400 });
      }
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
    console.error('[profile/settings]', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
