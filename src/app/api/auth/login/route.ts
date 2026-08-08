import { NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
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
    const detail = String((err && err.message) || err).replace(/postgres:\/\/[^@]*@/g, 'postgres://***@');
    return NextResponse.json({ error: 'diag', detail }, { status: 500 });
  }
}
