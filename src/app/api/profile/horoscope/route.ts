import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { listReadingsByType } from '@/lib/profile/store';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const horoscopes = await listReadingsByType(Number(decoded.userId), 'horoscope');
    return NextResponse.json({ horoscopes });
  } catch {
    return NextResponse.json({ error: 'Failed to load horoscopes' }, { status: 500 });
  }
}
