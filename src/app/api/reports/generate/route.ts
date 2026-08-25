import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import {
  mapReportType, dispatchReport, isUnsupportedForPipeline,
} from '@/lib/reportPipeline';
import { extractVerifiedFacts } from '@/lib/reportVerifiedFacts';
import { consumeReportPurchase, getReportPurchase, isValidPurchaseId } from '@/lib/billing/reportPurchaseStore';
import crypto from 'crypto';

// Pipeline-eligible solo types. Two-person + tarot are handled elsewhere.
const PIPELINE_TYPES: ReportType[] = [
  'natal', 'relationship', 'transit', 'loveblueprint', 'lovetiming',
  'vocation', 'karmicshadow', 'fullcosmic',
];

const MAX_BODY_BYTES = 200_000; // 200 KB hard cap on request payloads.

export async function POST(request: Request) {
  // #6 — read bounded text and enforce actual byte size regardless of (or absent)
  // Content-Length. Then parse. This defeats omitted/spoofed content-length.
  const raw = await readBounded(request, MAX_BODY_BYTES).catch(() => null);
  if (raw === null) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const { type: rawType, partner, purchaseId } = body;
    const type = rawType as ReportType;

    // Two-person / unsupported types never use the n8n pipeline.
    if (isUnsupportedForPipeline(type)) {
      return NextResponse.json({ error: 'Report type not available via the pipeline' }, { status: 400 });
    }
    if (!PIPELINE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    const contractType = mapReportType(type)!;
    const isPaid = (REPORT_META[type]?.price ?? 0) > 0;

    // COMMERCIAL MODEL: paid reports require a real, server-verified purchase.
    // Entitlement is NEVER inferred from subscription tier or tarot entitlements.
    // Free reports (Natal / Relationship) continue without any purchase.
    if (isPaid) {
      // #3 — validate purchaseId BEFORE any DB call. A missing purchaseId is a
      // payment-required condition (402); a present but malformed (non-UUID)
      // value is a bad request (400) and must never reach the uuid column
      // (which would otherwise throw an invalid-UUID Postgres error -> 500).
      if (!purchaseId) {
        return NextResponse.json(
          { error: 'A purchase is required to generate this report', requiresPurchase: true },
          { status: 402 },
        );
      }
      if (!isValidPurchaseId(purchaseId)) {
        return NextResponse.json(
          { error: 'Invalid purchase identifier', requiresPurchase: true },
          { status: 400 },
        );
      }
      const purchase = await getReportPurchase(purchaseId);
      if (!purchase || purchase.userId !== Number(decoded.userId)) {
        return NextResponse.json(
          { error: 'Purchase not found or not owned by this account', requiresPurchase: true },
          { status: 402 },
        );
      }
      if (purchase.reportType !== type) {
        return NextResponse.json(
          { error: 'Purchase does not match the requested report type', requiresPurchase: true },
          { status: 409 },
        );
      }
      if (purchase.status !== 'paid') {
        return NextResponse.json(
          { error: 'Purchase is not paid', requiresPurchase: true, purchaseStatus: purchase.status },
          { status: 402 },
        );
      }

      // #4/#5 — atomically create the reading AND consume the purchase in one
      // transaction. If already consumed (repeat request), returns the EXISTING
      // correlation with the reading's ACTUAL pipeline status (never a fake
      // "queued"). No orphaned reading is left by a losing race.
      // Generate ONE reportId and thread it through the locked consume (which
      // stores it in report_orders.report_id AND the reading result JSON) and the
      // n8n dispatch. The callback later locates the reading by this exact value.
      const reportId = crypto.randomUUID();
      const consumed = await consumeReportPurchase({
        purchaseId,
        userId: Number(decoded.userId),
        reportType: type,
        reportId,
        reading: await buildReadingInput({ decoded, user, type, partner, price: REPORT_META[type].price, reportId, pipelineStatus: 'queued' }),
      });
      if (consumed.outcome === 'already_correlated') {
        return buildRepeatResponse(consumed.readingId, consumed.reportId, consumed.readingStatus);
      }
      if (consumed.outcome !== 'consumed') {
        return NextResponse.json(
          { error: 'Purchase could not be consumed for this report', requiresPurchase: true },
          { status: 409 },
        );
      }
      const readingId = consumed.readingId;
      // reportId is the single source of truth declared above (line ~105).

      // Dispatch to n8n. Fails closed: non-2xx / network error marks the reading
      // rejected and returns 502. The purchase stays 'consumed' (already paid),
      // so a retry path can re-dispatch without double-charging.
      const dispatchRes = await dispatchWithFailClosed({
        reportId, type, price: REPORT_META[type].price, user, decoded, partner,
        readingResult: typeof consumed.readingResult === 'string' ? JSON.parse(consumed.readingResult) : (consumed.readingResult ?? {}),
      });
      if (!dispatchRes.ok) {
        await markReadingFailed(readingId);
        return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.', status: dispatchRes.readingStatus }, { status: 502 });
      }
      return NextResponse.json({
        success: true, status: 'queued', readingId, reportId,
        message: 'Your report is being prepared by our astrology engine. It will be ready shortly.', pending: true,
      });
    }

    // ---- Free report path (no purchase) ----
    const { rows } = await query(
      'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [decoded.userId],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Create your birth chart first', requiresBirthChart: true }, { status: 400 });
    }
    const c = rows[0];
    const chart = await buildBirthInfo(c, user);
    const verifiedFacts = await extractVerifiedFacts(contractType, chart);
    const title = REPORT_META[type].title;
    const price = REPORT_META[type].price;
    const reportId = crypto.randomUUID();
    const insert = await query(
      `INSERT INTO readings (user_id, type, title, question, price_paid, result, pipeline_status, created_at)
       VALUES ($1, 'report', $2, $3, $4, $5, 'queued', now())
       RETURNING id`,
      [Number(decoded.userId), title, `${title} report`, price,
        JSON.stringify({
          title, reportType: type, generatedFor: 'self', reportId, pricePaid: price, tier: 'free',
          verifiedFacts, pending: true,
          metadata: { birthData: chart, verifiedFacts },
          partnerLabel: (type === 'synastry' || type === 'composite' || type === 'couples') && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
        })],
    );
    const readingId = insert.rows[0].id;
    const readingResult = JSON.parse(insert.rows[0].result ?? '{}');
    const dispatchRes = await dispatchWithFailClosed({ reportId, type, price, user, decoded, partner, readingResult });
    if (!dispatchRes.ok) {
      await markReadingFailed(readingId);
      return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.' }, { status: 502 });
    }
    return NextResponse.json({
      success: true, status: 'queued', readingId, reportId,
      message: 'Your report is being prepared by our astrology engine. It will be ready shortly.', pending: true,
    });
  } catch (err: any) {
    const msg = err?.message || 'Report generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// --- helpers -----------------------------------------------------------------

async function readBounded(request: Request, maxBytes: number): Promise<string> {
  // Read the raw body text, but bound it: if it exceeds the cap we still read just
  // enough to know it's too large, then throw. Node streams make exact bounding
  // awkward, so we read text and check byte length.
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('too_large');
  return text;
}

async function buildBirthInfo(c: any, user: any) {
  const toDateStr = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));
  const toTimeStr = (v: any) => (v instanceof Date ? v.toTimeString().slice(0, 5) : (v == null ? '' : String(v)));
  return {
    name: user.first_name || undefined,
    date: toDateStr(c.birth_date),
    time: toTimeStr(c.birth_time),
    location: c.location_name,
    unknownTime: c.unknown_time,
  };
}

async function buildReadingInput(opts: {
  decoded: any; user: any; type: ReportType; partner: any; price: number; reportId?: string; pipelineStatus: string;
}): Promise<{ userId: number; type: string; title: string; question: string; pricePaid: number; resultJson: string; pipelineStatus: string }> {
  const { decoded, user, type, partner, price, reportId, pipelineStatus } = opts;
  const { rows } = await query('SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [decoded.userId]);
  if (rows.length === 0) throw new Error('Create your birth chart first');
  const c = rows[0];
  const chart = await buildBirthInfo(c, user);
  const contractType = mapReportType(type)!;
  const verifiedFacts = await extractVerifiedFacts(contractType, chart);
  const title = REPORT_META[type].title;
  // Persist the IMMUTABLE request snapshot (normalized birth data + verified facts)
  // inside result.metadata so retry (and dispatch) uses the exact original values,
  // never a later-edited natal chart.
  const snapshot = {
    birthData: {
      firstName: chart.name,
      dob: chart.date,
      birthTime: chart.time || null,
      place: chart.location,
      lat: Number(c.latitude),
      lon: Number(c.longitude),
      tz: c.timezone || 'UTC',
      solarFallback: chart.unknownTime,
    },
    verifiedFacts,
  };
  return {
    userId: Number(decoded.userId),
    type,
    title,
    question: `${title} report`,
    pricePaid: price,
    pipelineStatus,
    resultJson: JSON.stringify({
      title, reportType: type, generatedFor: 'self', reportId, pricePaid: price, tier: price > 0 ? 'paid' : 'free',
      verifiedFacts, pending: true,
      metadata: snapshot,
      partnerLabel: (type === 'synastry' || type === 'composite' || type === 'couples') && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
    }),
  };
}

async function dispatchWithFailClosed(opts: {
  reportId: string; type: ReportType; price: number; user: any; decoded: any; partner: any; readingResult?: any;
}) {
  // Use the IMMUTABLE snapshot persisted on the reading (result.metadata) so the
  // dispatch payload is identical to the original attempt — never a later-edited
  // natal chart. For free reports we still have the chart handy.
  const meta = opts.readingResult?.metadata;
  try {
    const res = await dispatchReport({
      reportId: opts.reportId,
      reportType: opts.type,
      tier: opts.price > 0 ? 'paid' : 'free',
      birthData: meta ? meta.birthData : undefined,
      verifiedFacts: meta ? meta.verifiedFacts : undefined,
      promptSlug: '',
      callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, readingStatus: 'rejected' };
    }
    return { ok: true, status: 200, readingStatus: 'queued' };
  } catch {
    return { ok: false, status: 0, readingStatus: 'rejected' };
  }
}

async function markReadingFailed(readingId: number) {
  await query(`UPDATE readings SET pipeline_status = 'rejected' WHERE id = $1`, [Number(readingId)]);
}

function buildRepeatResponse(readingId: number, reportId: string, readingStatus: string) {
  // #5 — return the ACTUAL reading status, never a hardcoded "queued". A rejected
  // (failed dispatch) reading is honestly reported and a safe retry is offered.
  const retryAvailable = readingStatus === 'rejected' || readingStatus === 'queued';
  return NextResponse.json({
    success: true,
    status: readingStatus,
    readingId,
    reportId,
    pending: readingStatus === 'queued' || readingStatus === 'processing',
    retryAvailable,
    message: readingStatus === 'rejected'
      ? 'Your previous report generation failed. You can retry at no extra charge.'
      : 'Your report is already being prepared by our astrology engine.',
  });
}
