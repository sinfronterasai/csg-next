import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReading } from '@/lib/tarot/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const readingId = Number(id);
  if (!Number.isInteger(readingId)) {
    return NextResponse.json({ error: 'Invalid reading id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await getUserById(String(decoded.userId));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reading = await getReading(readingId, Number(user.id));
  if (!reading) {
    return NextResponse.json({ error: 'Reading not found' }, { status: 404 });
  }
  return NextResponse.json(reading);
}
