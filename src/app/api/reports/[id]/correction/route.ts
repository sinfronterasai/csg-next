import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { approvePaidSnapshotCorrection, isValidPurchaseId, previewPaidSnapshotCorrection } from '@/lib/billing/reportPurchaseStore';
import { dispatchReport } from '@/lib/reportPipeline';
import type { ReportType } from '@/lib/reportEngine';
import crypto from 'crypto';

const MAX_BODY_BYTES = 2048;
const OLD_REPORT_ID = '6deeb156-4f6d-40e2-988d-a714ff966c39';

function bad(outcome: string) {
  return NextResponse.json({ error: outcome }, { status: outcome === 'not_entitled' ? 402 : outcome === 'not_found' ? 404 : 409 });
}

/** Privileged, server-side-only audited snapshot correction. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;
    const user = decoded ? await getUserById(decoded.userId) : null;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'editor' && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    const id = (await params).id;
    if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    let body: any;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Malformed body' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((k) => !['action', 'expectedReportId', 'digest', 'reason'].includes(k)) ||
        !isValidPurchaseId(body.expectedReportId) || body.expectedReportId !== OLD_REPORT_ID) {
      return NextResponse.json({ error: 'Expected the quarantined report correlation' }, { status: 400 });
    }
    if (body.action === 'preview') {
      const result = await previewPaidSnapshotCorrection(Number(id), body.expectedReportId);
      if (result.outcome !== 'preview') return bad(result.outcome);
      return NextResponse.json({ action: 'preview', oldReportId: result.oldReportId, digest: result.digest, snapshot: result.snapshot });
    }
    if (body.action !== 'approve' || !/^[a-f0-9]{64}$/.test(body.digest) || typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 500) {
      return NextResponse.json({ error: 'Approval requires the exact preview digest and a bounded reason' }, { status: 400 });
    }
    const reportId = crypto.randomUUID();
    const result = await approvePaidSnapshotCorrection({ readingId: Number(id), expectedReportId: body.expectedReportId,
      digest: body.digest, reportId, actorId: Number(user.id), reason: body.reason.trim() });
    if (result.outcome !== 'claimed') return bad(result.outcome);
    try {
      const dispatched = await dispatchReport({ reportId: result.reportId, reportType: result.reportType as ReportType, tier: 'paid',
        birthData: result.snapshot.birthData, verifiedFacts: result.snapshot.verifiedFacts, promptSlug: '', callbackUrl: process.env.CSG_REPORT_CALLBACK_URL });
      if (!dispatched.ok) throw new Error('Dispatch not confirmed');
    } catch {
      return NextResponse.json({ error: 'Dispatch unconfirmed; inspect pipeline execution before recovery', readingId: Number(id), reportId: result.reportId }, { status: 502 });
    }
    return NextResponse.json({ success: true, action: 'approved', status: 'queued', readingId: Number(id), reportId: result.reportId });
  } catch {
    return NextResponse.json({ error: 'Correction unavailable' }, { status: 500 });
  }
}
