import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;
    if (!decoded) return NextResponse.json({ status: 'signed_out' }, { headers });
    const { rows } = await query(
      `SELECT u.subscription_tier,
              EXISTS (SELECT 1 FROM whop_entitlements e
                       WHERE e.offer = 'relationship_dynamics' AND e.status = 'active'
                         AND (e.user_id = u.id OR lower(e.email) = lower(u.email))) AS unlocked
         FROM users u WHERE u.id = $1`,
      [Number(decoded.userId)],
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ status: 'signed_out' }, { headers });
    const allowed = user.unlocked === true || ['premium', 'premium_plus'].includes(user.subscription_tier);
    return NextResponse.json({ status: allowed ? 'unlocked' : 'locked' }, { headers });
  } catch {
    return NextResponse.json({ error: 'We could not check access. Please try again.' }, { status: 503, headers });
  }
}
