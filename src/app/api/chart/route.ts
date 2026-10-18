import { NextRequest, NextResponse } from 'next/server';
import { computeChart, EphemerisUnavailableError } from '../../../lib/chartEngine';
import { validateFreeBirthInput } from '../../../lib/freeBirthChart';

export const runtime = 'nodejs'; // WASM + fs require the Node.js runtime, not edge

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, date, time, location } = body || {};
    const rawUnknownTime = body?.unknownTime;
    if (rawUnknownTime !== undefined && typeof rawUnknownTime !== 'boolean') {
      return NextResponse.json({ error: 'Invalid birth input', details: 'unknownTime must be a boolean.' }, { status: 400 });
    }
    const unknownTime = rawUnknownTime === true;
    const inputCheck = validateFreeBirthInput({ date, time, location, unknownTime });
    if (!inputCheck.ok) {
      return NextResponse.json({ error: 'Invalid birth input', details: inputCheck.error }, { status: 400 });
    }
    const chart = await computeChart({
      name: name || '',
      date: inputCheck.value.date,
      time: inputCheck.value.time,
      location: inputCheck.value.location,
      unknownTime,
    });
    return NextResponse.json(chart);
  } catch (err: any) {
    const message = String(err?.message || '');
    if (/geocode: could not resolve location/i.test(message)) {
      return NextResponse.json({ error: 'Location not recognized', details: 'Could not resolve coordinates for that location. Try "City, Country".' }, { status: 400 });
    }
    if (err instanceof EphemerisUnavailableError) {
      return NextResponse.json({ error: 'Chart service temporarily unavailable', details: 'The astronomy calculation service could not return all required bodies. Please try again.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Chart calculation failed', details: 'The chart could not be calculated right now. Please try again.' }, { status: 502 });
  }
}
