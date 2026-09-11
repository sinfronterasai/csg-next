import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { computeChart, geocodeLocation, geocodeCoordinates } from '@/lib/chartEngine';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { compileFreeBirthChart, validateFreeBirthInput } from '@/lib/freeBirthChart';

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
    // pg returns DATE/TIME as JS Date objects; normalize once and use the
    // persisted coordinates + IANA timezone as the immutable calculation anchor.
    const toDateStr = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
    const toTimeStr = (v: any) => (v instanceof Date ? v.toTimeString().slice(0, 5) : (v == null ? '' : String(v).slice(0, 8)));
    const birthInfo = { date: toDateStr(c.birth_date), time: toTimeStr(c.birth_time), location: c.location_name, latitude: Number(c.latitude), longitude: Number(c.longitude), timezone: c.timezone, unknownTime: Boolean(c.unknown_time) };
    const ledgerResult = await buildVerifiedFactsForReport('natal', birthInfo);
    if (!ledgerResult.ok) return NextResponse.json({ hasChart: true, error: 'Birth chart data is temporarily unavailable' }, { status: 503 });
    const report = compileFreeBirthChart(ledgerResult.ledger);
    const natal = typeof c.natal_positions === 'string' ? JSON.parse(c.natal_positions) : c.natal_positions;
    const houses = typeof c.houses === 'string' ? JSON.parse(c.houses) : c.houses;
    const planets: any[] = natal?.planets || [];
    const ascendant = typeof c.ascendant === 'string' ? JSON.parse(c.ascendant) : c.ascendant;
    const midheaven = typeof c.midheaven === 'string' ? JSON.parse(c.midheaven) : c.midheaven;
    // Reconstruct a full ChartData shape (matches computeChart output) so the
    // saved-chart viewer (/my-chart -> BirthChartWheel) gets sun/moon/birth too.
    const chartData = {
      name: c.chart_name || 'Natal Map',
      birth: {
        date: c.birth_date,
        time: c.unknown_time ? '' : (c.birth_time || ''),
        location: c.location_name,
        latitude: c.latitude,
        longitude: c.longitude,
        unknownTime: Boolean(c.unknown_time),
      },
      planets,
      houses: houses || [],
      ascendant,
      midheaven,
      sun: planets.find((p: any) => p.key === 'sun') || null,
      moon: planets.find((p: any) => p.key === 'moon') || null,
    };
    return NextResponse.json({ hasChart: true, chart: chartData, report, chartId: c.id });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch birth chart' }, { status: 500 });
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
    const { name, date, time, location, latitude, longitude, unknownTime, chartId } = body;
    const inputCheck = validateFreeBirthInput({ date, time, location, latitude, longitude, unknownTime: Boolean(unknownTime) });
    if (!inputCheck.ok) return NextResponse.json({ error: 'Invalid birth input', details: inputCheck.error }, { status: 400 });
    // Resolve the zone at the exact coordinates used for calculation. A timezone
    // from a different forward-geocoded city must never be combined with them.
    let geo: { lat: number; lon: number; timezone: string } | null = null;
    if (latitude !== undefined || longitude !== undefined) {
      if (typeof latitude === 'number' && typeof longitude === 'number') geo = geocodeCoordinates(latitude, longitude);
    } else {
      geo = await geocodeLocation(location);
    }
    if (!geo) {
      return NextResponse.json({ error: 'Location not recognized', details: 'Could not resolve coordinates for that location. Try "City, Country" or "lat,lon".' }, { status: 400 });
    }
    const unknown = Boolean(unknownTime);
    // Compute from the verified server-side geocode, never by re-resolving the
    // raw place string. This makes the saved chart and its report eligibility use
    // exactly the validated coordinates and IANA timezone.
    const chart = await computeChart({
      name: name || '', date, time: unknown ? undefined : (time || '12:00'), location,
      latitude: geo.lat, longitude: geo.lon, timezone: geo.timezone, unknownTime: unknown,
    });
    const ledgerResult = await buildVerifiedFactsForReport('natal', {
      name, date, time: unknown ? undefined : (time || '12:00'), location,
      latitude: geo.lat, longitude: geo.lon, timezone: geo.timezone, unknownTime: unknown,
    });
    if (!ledgerResult.ok) return NextResponse.json({ error: 'Birth chart data is temporarily unavailable' }, { status: 503 });
    const report = compileFreeBirthChart(ledgerResult.ledger);

    // Update an existing owned chart when chartId is supplied (the "Update"
    // action); otherwise insert a new one ("Create Another"). This keeps a
    // single primary chart instead of stacking duplicates on every save.
    let savedId: number;
    if (chartId) {
      const upd = await query(
        `UPDATE natal_charts
            SET birth_date=$2, birth_time=$3, timezone=$4, location_name=$5, latitude=$6, longitude=$7,
                natal_positions=$8, houses=$9, ascendant=$10, midheaven=$11, chart_name=$12, unknown_time=$13
          WHERE id=$14 AND user_id=$1
         RETURNING id`,
        [
          decoded.userId, date, unknown ? null : (time || null), geo.timezone, location, geo.lat, geo.lon,
          JSON.stringify({ planets: chart.planets }),
          JSON.stringify(chart.houses),
          JSON.stringify(chart.ascendant),
          JSON.stringify(chart.midheaven),
          name || 'Primary Chart',
          unknown,
          chartId,
        ],
      );
      if (upd.rows.length === 0) {
        return NextResponse.json({ error: 'Chart not found or not owned by you' }, { status: 404 });
      }
      savedId = upd.rows[0].id;
    } else {
      const ins = await query(
        `INSERT INTO natal_charts (user_id, birth_date, birth_time, timezone, location_name, latitude, longitude, natal_positions, houses, ascendant, midheaven, chart_name, is_primary, unknown_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
         RETURNING id`,
        [
          decoded.userId, date, unknown ? null : (time || null), geo.timezone, location, geo.lat, geo.lon,
          JSON.stringify({ planets: chart.planets }),
          JSON.stringify(chart.houses),
          JSON.stringify(chart.ascendant),
          JSON.stringify(chart.midheaven),
          name || 'Primary Chart',
          unknown,
        ],
      );
      savedId = ins.rows[0].id;
    }
    // Build a complete ChartData-shaped response so consumers (birth-chart
    // result view, /my-chart, ChartsTab) get the same shape computeChart yields.
    const chartData = {
      name: name || '',
      birth: { date, time: unknown ? '' : (time || ''), location, latitude: geo.lat, longitude: geo.lon, unknownTime: unknown },
      planets: chart.planets,
      angles: chart.angles,
      houses: chart.houses,
      ascendant: chart.ascendant,
      midheaven: chart.midheaven,
      sun: chart.sun,
      moon: chart.moon,
    };
    return NextResponse.json({ success: true, chartId: savedId, chart: chartData, report });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to save birth chart' }, { status: 500 });
  }
}
