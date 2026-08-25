import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import {
  mapReportType, dispatchReport, isUnsupportedForPipeline,
} from '@/lib/reportPipeline';
import { extractVerifiedFacts } from '@/lib/reportVerifiedFacts';
import crypto from 'crypto';

// Pipeline-eligible solo types. Two-person + tarot are handled elsewhere.
const PIPELINE_TYPES: ReportType[] = [
  'natal', 'relationship', 'transit', 'loveblueprint', 'lovetiming',
  'vocation', 'karmicshadow', 'fullcosmic',
];

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { type: rawType, partner } = body;
    const type = rawType as ReportType;

    // Two-person / unsupported types never use the n8n pipeline.
    if (isUnsupportedForPipeline(type)) {
      return NextResponse.json({ error: 'Report type not available via the pipeline' }, { status: 400 });
    }
    if (!PIPELINE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    const contractType = mapReportType(type)!;
    const price = REPORT_META[type].price;
    const tier = price > 0 ? 'paid' : 'free';

    // R3.1 — paid reports require verified entitlement before dispatch.
    // Customer purchases are not enabled yet (John's final live test gates this).
    const entitlementVerified = !!body.entitlementVerified;
    if (tier === 'paid' && !entitlementVerified) {
      return NextResponse.json({ error: 'Payment required before generating this report' }, { status: 402 });
    }

    // Load saved chart (single source of truth for birth data).
    const { rows } = await query(
      'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [decoded.userId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Create your birth chart first', requiresBirthChart: true }, { status: 400 });
    }
    const c = rows[0];
    const toDateStr = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
    const toTimeStr = (v: any) => (v instanceof Date ? v.toTimeString().slice(0, 5) : (v == null ? '' : String(v)));

    const birthInfo = {
      name: user.first_name || undefined,
      date: toDateStr(c.birth_date),
      time: toTimeStr(c.birth_time),
      location: c.location_name,
      unknownTime: c.unknown_time,
    };

    // Authoritative facts (computed, deterministic). n8n interprets these.
    const verifiedFacts = await extractVerifiedFacts(contractType, birthInfo);

    // App-generated correlation id. Owner of the result is the existing reading row.
    const reportId = crypto.randomUUID();

    // Persist the queued record. We store verifiedFacts + reportId; the prose body
    // stays empty until n8n calls back. We never store raw facts as the deliverable.
    const title = REPORT_META[type].title;
    const insert = await query(
      `INSERT INTO readings (user_id, type, title, question, price_paid, result, pipeline_status, created_at)
       VALUES ($1, 'report', $2, $3, $4, $5, 'queued', now())
       RETURNING id`,
      [
        Number(decoded.userId), title, `${title} report`, price,
        JSON.stringify({
          title, reportType: type, generatedFor: 'self',
          reportId, pricePaid: price, tier,
          verifiedFacts, pending: true,
          partnerLabel: (type === 'synastry' || type === 'composite' || type === 'couples') && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
        }),
      ],
    );
    const readingId = insert.rows[0].id;

    // R1 — dispatch to n8n. Fails closed: if the pipeline env is missing or the
    // request errors, we mark the record failed and surface 502 (no local prose).
    try {
      await dispatchReport({
        reportId,
        reportType: type,
        tier,
        birthData: {
          firstName: birthInfo.name,
          dob: birthInfo.date,
          birthTime: birthInfo.time || null,
          place: birthInfo.location,
          lat: Number(c.latitude), lon: Number(c.longitude),
          tz: c.timezone || 'UTC',
          solarFallback: birthInfo.unknownTime,
        },
        verifiedFacts,
        promptSlug: '',
        callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
      });
    } catch (err: any) {
      console.error('[reports/generate] pipeline dispatch failed:', err?.message);
      await query("UPDATE readings SET pipeline_status = 'rejected' WHERE id = $1", [readingId]);
      return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.' }, { status: 502 });
    }

    // R3.5 — customer-facing in-progress copy. Never raw verifiedFacts.
    return NextResponse.json({
      success: true,
      status: 'queued',
      readingId,
      reportId,
      message: 'Your report is being prepared by our astrology engine. It will be ready shortly.',
      pending: true,
    });
  } catch (err: any) {
    const msg = err?.message || 'Report generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
