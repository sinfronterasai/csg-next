import { NextResponse } from 'next/server';
import { requireAuth } from './_auth';

export async function GET() {
  try {
    const r = await requireAuth();
    if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    return NextResponse.json({ user: r.user });
  } catch (err: any) {
    console.error('[profile]', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
