import { NextRequest, NextResponse } from 'next/server';
import { computeMoonResult, MoonInputValidationError } from '../../../lib/moonCalculator';

export const runtime = 'nodejs'; // WASM + fs require the Node.js runtime, not edge

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'request body must be valid JSON' }, { status: 400 });
    }
    const { date, time, location, unknownTime } = body || {};
    const result = await computeMoonResult({
      date,
      time,
      location,
      unknownTime,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof MoonInputValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (typeof err?.message === 'string' && err.message.startsWith('geocode:')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || 'moon calculation failed' }, { status: 500 });
  }
}
