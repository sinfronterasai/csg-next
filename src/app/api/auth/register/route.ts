import { NextResponse } from 'next/server';
import { createUser, generateToken, getUserByEmail } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }
    const user = await createUser({ email, password, firstName, lastName });
    const token = generateToken(user.id);
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
    });
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
