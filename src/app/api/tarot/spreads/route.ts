import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getEntitlement } from '@/lib/tarot/entitlements';
import { buildSpreadsResponse } from '@/lib/tarot/spreadsApi';
import type { Tier } from '@/lib/tarot/spreads';

export async function GET() {
  // No auth required: anonymous users see free spreads and locked premium ones.
  let tier: Tier | null = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const ent = await getEntitlement(decoded.userId);
        tier = ent.tier;
      }
    }
  } catch {
    // Any auth failure -> treat as anonymous (fail-safe to free).
    tier = null;
  }
  return NextResponse.json(buildSpreadsResponse(tier));
}
