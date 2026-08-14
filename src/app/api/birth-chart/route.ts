import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { computeChart, geocode } from '@/lib/chartEngine';

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
    const { name, date, time, location, latitude, longitude, timezone, unknownTime } = body;
    if (!date || !location) {
      return NextResponse.json({ error: 'Missing required fields', details: 'date and location are required' }, { status: 400 });
    }
    if (!unknownTime && !time) {
      return NextResponse.json({ error: 'Missing required fields', details: 'time is required unless unknownTime is set' }, { status: 400 });
    }
    // Geocode the location into lat/long when the caller didn't supply them.
    // Refuse to persist a silently-wrong fallback: if geocode returns the Paris
    // default for an unknown location, require the caller to pass real coords.
    let geo: { lat: number; lon: number } | null = null;
    if (latitude !== undefined && longitude !== undefined) {
      geo = { lat: latitude, lon: longitude };
    } else {
      const resolved = geocode(location);
      const isFallback = resolved.lat === 48.8566 && resolved.lon === 2.3522;
      if (!isFallback) geo = resolved;
    }
    if (!geo) {
      return NextResponse.json({ error: 'Location not recognized', details: 'Could not resolve coordinates for the given location. Try "City, Country" or "lat,lon".' }, { status: 400 });
    }
    const chart = await computeChart({ name: name || '', date, time: time || '12:00', location, unknownTime: Boolean(unknownTime) });
    const { rows } = await query(
      `INSERT INTO natal_charts (user_id, birth_date, birth_time, timezone, location_name, latitude, longitude, natal_positions, houses, ascendant, midheaven, chart_name, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
       RETURNING id`,
      [
        decoded.userId, date, time, timezone || 'UTC', location, geo.lat, geo.lon,
        JSON.stringify({ planets: chart.planets }),
        JSON.stringify(chart.houses),
        JSON.stringify(chart.ascendant),
        JSON.stringify(chart.midheaven),
        name || 'Primary Chart',
      ],
    );
    // Build a complete ChartData-shaped response so consumers (birth-chart
    // result view, /my-chart, ChartsTab) get the same shape computeChart yields.
    const chartData = {
      name: name || '',
      birth: { date, time: time || '12:00', location, latitude: geo.lat, longitude: geo.lon, unknownTime: Boolean(unknownTime) },
      planets: chart.planets,
      angles: chart.angles,
      houses: chart.houses,
      ascendant: chart.ascendant,
      midheaven: chart.midheaven,
      sun: chart.sun,
      moon: chart.moon,
    };
    return NextResponse.json({ success: true, chartId: rows[0].id, chart: chartData });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to save birth chart', details: err?.message }, { status: 500 });
  }
}
