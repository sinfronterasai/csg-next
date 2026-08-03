import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { buildRecommendResponse } from '@/lib/tarot/recommendApi';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) userId = decoded.userId;
    }
  } catch {
    userId = null;
  }

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
  }
  const category = typeof body.category === 'string' ? body.category : null;

  const res = await buildRecommendResponse(userId, { question, category });
  return NextResponse.json(res);
}
