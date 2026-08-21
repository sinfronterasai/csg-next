import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { saveUniversalReading } from '@/lib/profile/store';
import {
  buildNatalReport, buildRelationshipMatrixReport, buildTransitReport, buildLoveBlueprintReport,
  buildLoveTimingReport, buildSynastryReport, buildCompositeReport, buildCouplesBundleReport,
  buildVocationReport, buildKarmicShadowReport, buildFullCosmicBundleReport,
  type ReportType, REPORT_META, PARTNER_REQUIRED,
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
  // pg returns DATE/TIME columns as JS Date objects; computeChart needs a
  // 'YYYY-MM-DD' string, so coerce before handing off (else date.split crashes).
  const toDateStr = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
  const toTimeStr = (v: any) => (v instanceof Date ? v.toTimeString().slice(0, 5) : (v == null ? '' : String(v)));
  return {
    birthInfo: { date: toDateStr(c.birth_date), time: toTimeStr(c.birth_time), location: c.location_name, latitude: c.latitude, longitude: c.longitude, unknownTime: c.unknown_time },
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
    const type = rawType as ReportType; // see ReportType union in reportEngine

    const chart = await getSavedChart(decoded.userId);
    if (!chart) {
      return NextResponse.json({ error: 'Create your birth chart first', requiresBirthChart: true }, { status: 400 });
    }

    // Route every report through the single engine (report-design PART 3 #1).
    const validTypes: ReportType[] = ['natal', 'relationship', 'transit', 'loveblueprint', 'lovetiming', 'synastry', 'composite', 'couples', 'vocation', 'karmicshadow', 'fullcosmic'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    // Two-person reports need a partner's birth data (privacy-by-design: B's data
    // is used ONLY for this report). Raise 400 early if it's missing.
    if (PARTNER_REQUIRED.has(type) && (!partner || !partner.birthDate)) {
      return NextResponse.json({ error: 'Partner birth date is required for this report' }, { status: 400 });
    }

    let report;
    const partnerInfo = partner ? {
      date: partner.birthDate,
      time: partner.birthTime,
      location: partner.location || chart.birthInfo.location,
      unknownTime: !partner.birthTime,
    } : undefined;
    try {
      switch (type) {
        case 'natal':
          report = await buildNatalReport(chart.birthInfo); break;
        case 'relationship':
          report = await buildRelationshipMatrixReport({ natal: chart.birthInfo }); break;
        case 'transit':
          report = await buildTransitReport({ natal: chart.birthInfo }); break;
        case 'loveblueprint':
          report = await buildLoveBlueprintReport({ natal: chart.birthInfo }); break;
        case 'lovetiming':
          report = await buildLoveTimingReport({ natal: chart.birthInfo }); break;
        case 'vocation':
          report = await buildVocationReport({ natal: chart.birthInfo }); break;
        case 'karmicshadow':
          report = await buildKarmicShadowReport({ natal: chart.birthInfo }); break;
        case 'synastry':
          report = await buildSynastryReport({ self: chart.birthInfo, partner: partnerInfo! }); break;
        case 'composite':
          report = await buildCompositeReport({ self: chart.birthInfo, partner: partnerInfo! }); break;
        case 'couples':
          report = await buildCouplesBundleReport({ self: chart.birthInfo, partner: partnerInfo! }); break;
        case 'fullcosmic':
          report = await buildFullCosmicBundleReport({ natal: chart.birthInfo, partner: partnerInfo }); break;
        default:
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
        partnerLabel: (type === 'synastry' || type === 'composite' || type === 'couples' || type === 'fullcosmic') && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
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
