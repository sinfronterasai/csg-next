import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';

const noCache = { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Expires: '0' };

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200, headers: noCache });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      const res = NextResponse.json({ user: null }, { status: 200, headers: noCache });
      res.cookies.delete('auth_token');
      return res;
    }
    const user = await getUserById(decoded.userId);
    if (!user) {
      const res = NextResponse.json({ user: null }, { status: 200, headers: noCache });
      res.cookies.delete('auth_token');
      return res;
    }
    return NextResponse.json({
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
    }, { headers: noCache });
  } catch {
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500, headers: noCache });
  }
}
