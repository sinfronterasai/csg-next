import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById, hashPassword, verifyPassword } from '@/lib/auth';
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
    const { current, next: newPassword } = body;
    if (!current || !newPassword) {
      return NextResponse.json({ error: 'current and next are required' }, { status: 400 });
    }

    // Fetch password_hash (not in getUserById by default)
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [decoded.userId]);
    const currentHash = rows[0]?.password_hash;
    if (!currentHash) return NextResponse.json({ error: 'No password set' }, { status: 400 });

    const valid = await verifyPassword(current, currentHash);
    if (!valid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, decoded.userId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to change password' }, { status: 500 });
  }
}
