import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { saveUniversalReading } from '@/lib/profile/store';

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
    const { sign, scope, text, periodStart, periodEnd } = body;
    if (!sign || !scope || !text) {
      return NextResponse.json({ error: 'sign, scope, and text are required' }, { status: 400 });
    }

    const row = await saveUniversalReading({
      userId: Number(decoded.userId),
      type: 'horoscope',
      title: `${sign} ${scope}`,
      question: `${sign} · ${scope}`,
      scope,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      result: { text, sign, scope },
    });

    return NextResponse.json({ success: true, id: row.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save horoscope' }, { status: 500 });
  }
}
