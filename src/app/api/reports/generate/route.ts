import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { saveUniversalReading } from '@/lib/profile/store';
import {
  buildNatalReport, buildTransitReport, buildSynastryReport, buildVocationReport,
  type ReportType, REPORT_META,
} from '@/lib/reportEngine';

async function getSavedChart(userId: string) {
  const { rows } = await query(
    'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId],
  );
  if (rows.length === 0) return null;
  const c = rows[0];
  const natal = typeof c.natal_positions === 'string' ? JSON.parse(c.natal_positions) : c.natal_positions;
  const houses = typeof c.houses === 'string' ? JSON.parse(c.houses) : c.houses;
  return {
    birthInfo: { date: c.birth_date, time: c.birth_time, location: c.location_name, latitude: c.latitude, longitude: c.longitude, unknownTime: c.unknown_time },
    planets: natal?.planets || [],
    houses: houses || [],
    ascendant: c.ascendant,
    midheaven: c.midheaven,
  };
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
    const user = await getUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { type: rawType, partner } = body;
    const type = rawType as ReportType; // type: natal | transit | synastry | vocation

    const chart = await getSavedChart(decoded.userId);
    if (!chart) {
      return NextResponse.json({ error: 'Create your birth chart first', requiresBirthChart: true }, { status: 400 });
    }

    // Route every report through the single engine (report-design PART 3 #1).
    const validTypes: ReportType[] = ['natal', 'transit', 'synastry', 'vocation'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    let report;
    try {
      if (type === 'transit') {
        report = await buildTransitReport({ natal: chart.birthInfo });
      } else if (type === 'vocation') {
        report = await buildVocationReport({ natal: chart.birthInfo });
      } else if (type === 'synastry') {
        if (!partner || !partner.birthDate) {
          return NextResponse.json({ error: 'Partner birth date required for synastry' }, { status: 400 });
        }
        report = await buildSynastryReport({
          self: chart.birthInfo,
          partner: {
            date: partner.birthDate,
            time: partner.birthTime,
            location: partner.location || chart.birthInfo.location,
            unknownTime: !partner.birthTime,
          },
        });
      } else {
        report = await buildNatalReport(chart.birthInfo);
      }
    } catch (err) {
      console.error('[reports/generate] engine failed:', err);
      return NextResponse.json({ error: 'Report computation failed' }, { status: 500 });
    }

    const text = report.markdown;

    // Persist the report to the unified readings journal
    let readingId: number | undefined;
    try {
      const title = REPORT_META[type].title;
      const pricePaid = REPORT_META[type].price;
      const row = await saveUniversalReading({
        userId: Number(decoded.userId),
        type: 'report',
        title,
        question: `${title} report`,
        pricePaid,
        partnerLabel: type === 'synastry' && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
        result: {
          title,
          text,
          reportType: type,
          generatedFor: report.generatedFor,
          pricePaid,
          overview: report.overview,
          sections: report.sections,
        },
      });
      readingId = row.id;
    } catch (err) {
      console.error('[reports/generate] failed to persist report:', err);
      return NextResponse.json({ error: 'Report generated but could not be saved to your journal. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      type,
      title: report.title,
      text,
      overview: report.overview,
      sections: report.sections,
      readingId,
    });
  } catch (err: any) {
    const msg = err?.message || 'Report generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
