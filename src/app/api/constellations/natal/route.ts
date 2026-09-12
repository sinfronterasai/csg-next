import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hasSecureJwtConfiguration, verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { buildNatalNavigator, validateNatalNavigatorResponse } from '@/lib/constellations/natal';

const ERRORS = {
  auth: { error: { code: 'AUTH_REQUIRED', message: 'Sign in to personalize your Cosmic Navigator.' } },
  missing: { error: { code: 'NATAL_CHART_NOT_FOUND', message: 'Create your birth chart to personalize the map.' } },
  unknownTime: { error: { code: 'BIRTH_TIME_UNKNOWN', message: 'Add an exact birth time to show your natal sky.' } },
  unavailable: { error: { code: 'NAVIGATOR_UNAVAILABLE', message: 'Your natal sky is temporarily unavailable. Please try again.' } },
} as const;

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  try {
    if (!hasSecureJwtConfiguration()) return NextResponse.json(ERRORS.unavailable, { status: 503, headers: noStore });
    const token = (await cookies()).get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;
    if (!decoded) return NextResponse.json(ERRORS.auth, { status: 401, headers: noStore });

    const { rows } = await query(
      'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [decoded.userId],
    );
    if (rows.length === 0) return NextResponse.json(ERRORS.missing, { status: 404, headers: noStore });
    const chart = rows[0];
    if (Boolean(chart.unknown_time)) return NextResponse.json(ERRORS.unknownTime, { status: 409, headers: noStore });

    const payload = await buildNatalNavigator(chart);
    if (!validateNatalNavigatorResponse(payload)) throw new Error('Invalid navigator response');
    return NextResponse.json(payload, { status: 200, headers: noStore });
  } catch {
    return NextResponse.json(ERRORS.unavailable, { status: 503, headers: noStore });
  }
}
