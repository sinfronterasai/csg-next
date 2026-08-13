import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { updateReflection } from '@/lib/profile/store';

const MAX_REFLECTION = 5000;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const rawId = body.id;
    const id = typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId > 0 ? rawId : NaN;
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id must be a positive safe integer' }, { status: 400 });
    }
    const rawRef = body.reflection;
    if (typeof rawRef !== 'string') {
      return NextResponse.json({ error: 'reflection must be a string' }, { status: 400 });
    }
    const reflection = rawRef.slice(0, MAX_REFLECTION);

    const row = await updateReflection(id, Number(decoded.userId), reflection);
    if (!row) return NextResponse.json({ error: 'Reading not found' }, { status: 404 });

    return NextResponse.json({ success: true, reflection: row.reflection });
  } catch (err: any) {
    console.error('[profile/reflection]', err);
    return NextResponse.json({ error: 'Failed to update reflection' }, { status: 500 });
  }
}
