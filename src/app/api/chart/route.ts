import { NextRequest, NextResponse } from 'next/server';
import { computeChart } from '../../../lib/chartEngine';

export const runtime = 'nodejs'; // WASM + fs require the Node.js runtime, not edge

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, date, time, location, unknownTime } = body || {};
    if (!date || !location) {
      return NextResponse.json({ error: 'date and location are required' }, { status: 400 });
    }
    const chart = await computeChart({
      name: name || '',
      date,
      time: time || '12:00',
      location,
      unknownTime: Boolean(unknownTime),
    });
    return NextResponse.json(chart);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'chart computation failed' }, { status: 500 });
  }
}
