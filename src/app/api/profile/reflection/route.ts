import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { updateReflection } from '@/lib/profile/store';

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
    const { id, reflection } = body;
    if (!id || reflection === undefined) {
      return NextResponse.json({ error: 'id and reflection are required' }, { status: 400 });
    }

    const row = await updateReflection(id, Number(decoded.userId), reflection);
    if (!row) return NextResponse.json({ error: 'Reading not found' }, { status: 404 });

    return NextResponse.json({ success: true, reflection: row.reflection });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update reflection' }, { status: 500 });
  }
}
