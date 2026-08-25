import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import {
  mapReportType, dispatchReport, isUnsupportedForPipeline,
} from '@/lib/reportPipeline';
import { extractVerifiedFacts } from '@/lib/reportVerifiedFacts';
import { consumeReportPurchase, getReportPurchase } from '@/lib/billing/reportPurchaseStore';
import { setReadingDispatchFailed } from '@/lib/profile/store';
import crypto from 'crypto';

// Pipeline-eligible solo types. Two-person + tarot are handled elsewhere.
const PIPELINE_TYPES: ReportType[] = [
  'natal', 'relationship', 'transit', 'loveblueprint', 'lovetiming',
  'vocation', 'karmicshadow', 'fullcosmic',
];

const MAX_BODY_BYTES = 200_000; // 200 KB hard cap on request payloads.

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const body = await request.json().catch(() => ({}));
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
    let purchaseCorrelation: { readingId: number; reportId: string } | null = null;
    if (isPaid) {
      if (!purchaseId || typeof purchaseId !== 'string') {
        return NextResponse.json(
          { error: 'A valid purchase is required to generate this report', requiresPurchase: true },
          { status: 402 },
        );
      }
      const purchase = await getReportPurchase(purchaseId);
      // Paid state is verified from the persisted, webhook-confirmed purchase.
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
      // If a prior dispatch already correlated this purchase, return it without
      // re-dispatching (idempotent repeat request).
      if (purchase.status === 'consumed' && purchase.readingId != null && purchase.reportId != null) {
        return NextResponse.json({
          success: true,
          status: 'queued',
          readingId: purchase.readingId,
          reportId: purchase.reportId,
          message: 'Your report is already being prepared by our astrology engine.',
          pending: true,
        });
      }
      if (purchase.status !== 'paid') {
        return NextResponse.json(
          { error: 'Purchase is not paid', requiresPurchase: true, purchaseStatus: purchase.status },
          { status: 402 },
        );
      }
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

    const title = REPORT_META[type].title;
    const price = REPORT_META[type].price;
    const insert = await query(
      `INSERT INTO readings (user_id, type, title, question, price_paid, result, pipeline_status, created_at)
       VALUES ($1, 'report', $2, $3, $4, $5, 'queued', now())
       RETURNING id`,
      [
        Number(decoded.userId), title, `${title} report`, price,
        JSON.stringify({
          title, reportType: type, generatedFor: 'self',
          reportId, pricePaid: price, tier: price > 0 ? 'paid' : 'free',
          verifiedFacts, pending: true,
          partnerLabel: (type === 'synastry' || type === 'composite' || type === 'couples') && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
        }),
      ],
    );
    const readingId = insert.rows[0].id;

    // Atomically consume the purchase against this reading (one purchase -> one report).
    if (isPaid && purchaseId) {
      const consumed = await consumeReportPurchase({
        purchaseId,
        userId: Number(decoded.userId),
        reportType: type,
        readingId,
        reportId,
      });
      if (consumed.outcome === 'already_correlated') {
        // Race/again: another request won. Return the winning correlation, no dispatch.
        return NextResponse.json({
          success: true, status: 'queued',
          readingId: consumed.readingId, reportId: consumed.reportId,
          message: 'Your report is already being prepared by our astrology engine.',
          pending: true,
        });
      }
      if (consumed.outcome !== 'consumed') {
        // Purchase state changed underneath us (e.g. consumed elsewhere, or not paid).
        await setReadingDispatchFailed(Number(readingId));
        return NextResponse.json(
          { error: 'Purchase could not be consumed for this report', requiresPurchase: true },
          { status: 409 },
        );
      }
    }

    // R1 — dispatch to n8n. Fails closed: any non-2xx (or error) leaves the report
    // in a terminal 'rejected' state and surfaces 502 (never local prose).
    try {
      const res = await dispatchReport({
        reportId,
        reportType: type,
        tier: price > 0 ? 'paid' : 'free',
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
      if (!res.ok) {
        throw new Error(`n8n dispatch rejected with status ${res.status}`);
      }
    } catch (err: any) {
      console.error('[reports/generate] pipeline dispatch failed:', err?.message);
      await setReadingDispatchFailed(Number(readingId));
      return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.' }, { status: 502 });
    }

    // Customer-facing in-progress copy. Never raw verifiedFacts.
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
