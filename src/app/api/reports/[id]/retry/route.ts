import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import { mapReportType, dispatchReport, isUnsupportedForPipeline } from '@/lib/reportPipeline';
import { getReportPurchaseByReadingId, claimRetry, markReadingDispatchFailed } from '@/lib/billing/reportPurchaseStore';

// POST /api/reports/[id]/retry
// Safe retry for a FAILED dispatch (dispatch_failed / rejected). Re-dispatches to n8n
// using the SAME report correlation and the IMMUTABLE original request snapshot.
// It is only allowed when the associated purchase is already 'consumed' (paid), so a
// retry NEVER charges again. Owner-checked.
//
// Concurrency: claimRetry() does an atomic UPDATE ... WHERE pipeline_status IN
// ('dispatch_failed','rejected') RETURNING. Two simultaneous retries race; exactly
// one wins the row (returns 200). The loser gets 0 rows -> 409 (no double dispatch).
const MAX_BODY_BYTES = 200_000;

const RETRYABLE = new Set(['dispatch_failed', 'rejected']);

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
    // #2 — NEVER retry queued/processing/needs_editor/approved. Only terminal
    // dispatch failures (dispatch_failed) or quality rejections (rejected).
    if (!RETRYABLE.has(status)) {
      return NextResponse.json({ error: 'Report is not in a retryable state', status }, { status: 409 });
    }

    // #5 — only retry if the purchase is already consumed (paid). No double charge.
    const purchase = await getReportPurchaseByReadingId(readingId);
    if (!purchase || purchase.status !== 'consumed') {
      return NextResponse.json({ error: 'No paid purchase associated with this report' }, { status: 402 });
    }

    // #3 — atomic, stateful claim. Loser gets 409.
    const { claimed } = await claimRetry(readingId, decoded.userId);
    if (!claimed) {
      return NextResponse.json({ error: 'Retry already in progress or no longer retryable' }, { status: 409 });
    }

    const reportId: string = r.result?.reportId;
    const type = r.result?.reportType as ReportType;
    if (isUnsupportedForPipeline(type)) {
      await markReadingDispatchFailed(readingId);
      return NextResponse.json({ error: 'Report type not retryable via the pipeline' }, { status: 400 });
    }

    // #4 — reuse the IMMUTABLE snapshot stored on the reading. Never re-read the
    // user's latest natal chart (which may have changed after purchase).
    const snapshot = r.result?.metadata;
    if (!snapshot || !snapshot.birthData || !snapshot.verifiedFacts) {
      await markReadingDispatchFailed(readingId);
      return NextResponse.json({ error: 'Missing original request snapshot; cannot retry safely' }, { status: 409 });
    }

    try {
      const res = await dispatchReport({
        reportId,
        reportType: type,
        tier: (REPORT_META[type]?.price ?? 0) > 0 ? 'paid' : 'free',
        birthData: snapshot.birthData,
        verifiedFacts: snapshot.verifiedFacts,
        promptSlug: '',
        callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
      });
      if (!res.ok) throw new Error(`n8n rejected with status ${res.status}`);
    } catch (err: any) {
      // #3 — if the retry dispatch itself fails, restore the terminal failed state
      // (so it can be retried again, not left stuck in 'queued').
      console.error('[reports/retry] dispatch failed:', err?.message);
      await markReadingDispatchFailed(readingId);
      return NextResponse.json({ error: 'Report pipeline unavailable. Please try again shortly.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, status: 'queued', readingId, reportId, message: 'Your report is being regenerated.' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Retry failed' }, { status: 500 });
  }
}
