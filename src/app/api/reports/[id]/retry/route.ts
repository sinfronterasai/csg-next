import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import { mapReportType, dispatchReport, isUnsupportedForPipeline } from '@/lib/reportPipeline';
import { extractVerifiedFacts } from '@/lib/reportVerifiedFacts';
import { getReportPurchaseByReadingId } from '@/lib/billing/reportPurchaseStore';

// POST /api/reports/[id]/retry
// Safe retry for a failed/queued report. Re-dispatches to n8n using the SAME
// report correlation. It is only allowed when the associated purchase is already
// 'consumed' (i.e. already paid) — so a retry NEVER charges again. Owner-checked.
const MAX_BODY_BYTES = 200_000;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  const { id } = await params;
  const readingId = Number(id);
  if (!Number.isInteger(readingId) || readingId <= 0) {
    return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    // Load the reading (owner-checked) and confirm it is retryable.
    const { rows } = await query(
      `SELECT id, user_id, type, title, result, pipeline_status FROM readings WHERE id = $1`,
      [readingId],
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    const r = rows[0];
    if (Number(r.user_id) !== Number(decoded.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const status: string = r.pipeline_status ?? (r.result?.pipeline?.status ?? '');
    if (status !== 'rejected' && status !== 'queued') {
      return NextResponse.json({ error: 'Report is not in a retryable state', status }, { status: 409 });
    }

    // #5 — only retry if the purchase is already consumed (paid). No double charge.
    const purchase = await getReportPurchaseByReadingId(readingId);
    if (!purchase || purchase.status !== 'consumed') {
      return NextResponse.json({ error: 'No paid purchase associated with this report' }, { status: 402 });
    }

    const reportId: string = r.result?.reportId;
    const type = r.result?.reportType as ReportType;
    const contractType = mapReportType(type)!;
    if (isUnsupportedForPipeline(type)) {
      return NextResponse.json({ error: 'Report type not retryable via the pipeline' }, { status: 400 });
    }

    // Re-derive birth data + facts (deterministic) and dispatch again.
    const { rows: chartRows } = await query('SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [decoded.userId]);
    if (chartRows.length === 0) return NextResponse.json({ error: 'Create your birth chart first' }, { status: 400 });
    const c = chartRows[0];
    const chart = {
      name: user.first_name || undefined,
      date: c.birth_date instanceof Date ? c.birth_date.toISOString().slice(0, 10) : String(c.birth_date ?? '').slice(0, 10),
      time: c.birth_time instanceof Date ? c.birth_time.toTimeString().slice(0, 5) : (c.birth_time == null ? '' : String(c.birth_time)),
      location: c.location_name,
      unknownTime: c.unknown_time,
    };
    const verifiedFacts = await extractVerifiedFacts(contractType, chart);
    const price = REPORT_META[type]?.price ?? 0;

    try {
      const res = await dispatchReport({
        reportId,
        reportType: type,
        tier: price > 0 ? 'paid' : 'free',
        birthData: {
          firstName: chart.name, place: chart.location,
          dob: chart.date, birthTime: chart.time || null,
          lat: Number(c.latitude), lon: Number(c.longitude),
          tz: c.timezone || 'UTC', solarFallback: chart.unknownTime,
        },
        verifiedFacts,
        promptSlug: '',
        callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
      });
      if (!res.ok) throw new Error(`n8n rejected with status ${res.status}`);
    } catch (err: any) {
      console.error('[reports/retry] dispatch failed:', err?.message);
      return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, status: 'queued', readingId, reportId, message: 'Your report is being regenerated.' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Retry failed' }, { status: 500 });
  }
}
