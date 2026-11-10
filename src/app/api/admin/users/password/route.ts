import { NextResponse } from 'next/server';
import { AdminUserError, changeUserPassword, currentAdminUser } from '@/lib/admin/users';

const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request) {
  try {
    const user = await currentAdminUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers });
    }
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers }); }
    const { userId, currentPassword, newPassword, reason } = body || {};
    if (!/^[1-9]\d{0,9}$/.test(String(userId)) || typeof currentPassword !== 'string' || currentPassword.length < 1 || Buffer.byteLength(currentPassword, 'utf8') > 72
      || typeof newPassword !== 'string' || newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72
      || typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
      return NextResponse.json({ error: 'Enter a valid user, your current password, a new password of at least 12 characters (maximum 72 bytes), and a reason of 5–500 characters.' }, { status: 400, headers });
    }
    await changeUserPassword(String(user.id), String(userId), currentPassword, newPassword, reason.trim());
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    if (error instanceof AdminUserError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error('[admin/users/password] change failed');
    return NextResponse.json({ error: 'Unable to change password right now.' }, { status: 500, headers });
  }
}
