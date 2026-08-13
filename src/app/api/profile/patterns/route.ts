import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { listReadingsByType } from '@/lib/profile/store';
import { buildEntitlement, getEntitlement } from '@/lib/tarot/entitlements';
import { computePatterns } from '@/lib/profile/patterns';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    // Cosmic Pass gate. Free tier cannot view Patterns.
    const entitlement = await getEntitlement(decoded.userId);
    if (entitlement.tier === 'free') {
      return NextResponse.json(
        { error: 'Patterns is a Cosmic Pass feature', upgrade: true, message: 'Upgrade to Cosmic Pass to reveal the patterns across your readings.' },
        { status: 403 },
      );
    }

    const [tarot, reports, horoscopes] = await Promise.all([
      listReadingsByType(Number(decoded.userId), 'tarot'),
      listReadingsByType(Number(decoded.userId), 'report'),
      listReadingsByType(Number(decoded.userId), 'horoscope'),
    ]);
    const all = [...tarot, ...reports, ...horoscopes];

    const patterns = computePatterns(all, {
      horoscopeSign: user.horoscope_sign || null,
      patternsOptIn: user.patterns_opt_in !== false,
    });

    return NextResponse.json({ patterns });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to compute patterns' }, { status: 500 });
  }
}
