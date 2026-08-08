import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { createCheckoutSession, type Tier } from '@/lib/billing/stripe';

const VALID: Tier[] = ['premium', 'premium_plus'];

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const decoded = verifyToken(token);
  if (!decoded) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tier = body.tier as Tier;
  if (!VALID.includes(tier)) {
    return NextResponse.json({ error: 'Invalid or unsupported tier.' }, { status: 400 });
  }

  const user = await getUserById(Number(decoded.userId));
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  try {
    const origin = request.nextUrl.origin;
    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      tier,
      origin,
    });
    if (!url) return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 502 });
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Checkout failed.' }, { status: 502 });
  }
}
