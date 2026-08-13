import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export interface AuthedUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  display_name: string | null;
  horoscope_sign: string | null;
  patterns_opt_in: boolean;
  subscription_tier: string | null;
}

export async function requireAuth(): Promise<
  | { ok: true; userId: number; user: AuthedUser }
  | { ok: false; status: 401 | 404; body: Record<string, unknown> }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return { ok: false, status: 401, body: { error: 'Authentication required' } };
  const decoded = verifyToken(token);
  if (!decoded) return { ok: false, status: 401, body: { error: 'Authentication required' } };

  const userId = Number(decoded.userId);
  // Single round-trip: load all profile columns from the one users row.
  const { rows } = await query(
    `SELECT email, first_name, last_name, role,
            display_name, horoscope_sign, patterns_opt_in, subscription_tier
       FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { ok: false, status: 401, body: { error: 'User not found' } };

  const user: AuthedUser = {
    id: userId,
    email: row.email,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    role: row.role,
    display_name: row.display_name ?? null,
    horoscope_sign: row.horoscope_sign ?? null,
    patterns_opt_in: row.patterns_opt_in !== false,
    subscription_tier: row.subscription_tier ?? null,
  };
  return { ok: true, userId, user };
}
