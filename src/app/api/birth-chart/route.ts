import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { computeChart } from '@/lib/chartEngine';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ hasChart: false, error: 'Authentication required', message: 'Please sign in to view your saved birth chart.' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ hasChart: false, error: 'Authentication required' }, { status: 401 });
    }
    const { rows } = await query(
      'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [decoded.userId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ hasChart: false, message: 'No birth chart found. Please create one first.' });
    }
    const c = rows[0];
    const natal = typeof c.natal_positions === 'string' ? JSON.parse(c.natal_positions) : c.natal_positions;
    const houses = typeof c.houses === 'string' ? JSON.parse(c.houses) : c.houses;
    const chartData = {
      planets: natal?.planets || [],
      houses: houses || [],
      ascendant: c.ascendant,
      midheaven: c.midheaven,
    };
    const birthInfo = { date: c.birth_date, time: c.birth_time, location: c.location_name, latitude: c.latitude, longitude: c.longitude };
    return NextResponse.json({ hasChart: true, chart: chartData, birthInfo, chartId: c.id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch birth chart', details: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const body = await request.json();
    const { name, date, time, location, latitude, longitude, timezone } = body;
    if (!date || !time || !location || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Missing required fields', details: 'date, time, location, latitude, longitude are required' }, { status: 400 });
    }
    const chart = await computeChart({ name: name || '', date, time: time || '12:00', location, unknownTime: false });
    const { rows } = await query(
      `INSERT INTO natal_charts (user_id, birth_date, birth_time, timezone, location_name, latitude, longitude, natal_positions, houses, ascendant, midheaven, chart_name, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
       RETURNING id`,
      [
        decoded.userId, date, time, timezone || 'UTC', location, latitude, longitude,
        JSON.stringify({ planets: chart.planets }),
        JSON.stringify(chart.houses),
        JSON.stringify(chart.ascendant),
        JSON.stringify(chart.midheaven),
        name || 'Primary Chart',
      ],
    );
    return NextResponse.json({ success: true, chartId: rows[0].id, chart });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to save birth chart', details: err?.message }, { status: 500 });
  }
}
