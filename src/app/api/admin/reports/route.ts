import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { listPaidReportsForRole } from '@/lib/profile/staff';

async function staffUser() {
  const token = (await cookies()).get('auth_token')?.value;
  const decoded = token ? verifyToken(token) : null;
  return decoded ? getUserById(decoded.userId) : null;
}

export async function GET(_request: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (user.role !== 'editor' && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const reports = await listPaidReportsForRole();
  return NextResponse.json({ reports });
}
