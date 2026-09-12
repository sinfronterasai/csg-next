import { NextRequest, NextResponse } from 'next/server';
import { computeMoonResult } from '../../../lib/moonCalculator';

export const runtime = 'nodejs'; // WASM + fs require the Node.js runtime, not edge

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, time, location, unknownTime } = body || {};
    if (!date || !location) {
      return NextResponse.json({ error: 'date and location are required' }, { status: 400 });
    }
    const result = await computeMoonResult({
      date,
      time: time || '12:00',
      location,
      unknownTime: Boolean(unknownTime),
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'moon calculation failed' }, { status: 500 });
  }
}
