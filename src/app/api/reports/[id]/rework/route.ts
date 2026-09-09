import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { claimPaidRework, isValidPurchaseId } from '@/lib/billing/reportPurchaseStore';
import { dispatchReport } from '@/lib/reportPipeline';
import type { ReportType } from '@/lib/reportEngine';
import crypto from 'crypto';

// Uses the same database-backed editor/admin session policy as editor-decision.
// Browser callers never receive or submit the pipeline bearer. No billing calls.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;
    const user = decoded ? await getUserById(decoded.userId) : null;
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'editor' && user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // Session-authenticated mutations must be same-origin, including operator tools.
    if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    const { id } = await params;
    if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 2048) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Malformed body' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => !['expectedReportId', 'reason'].includes(key)) ||
        !isValidPurchaseId(body.expectedReportId) || typeof body.reason !== 'string' ||
        body.reason.trim().length < 5 || body.reason.length > 500) {
      return NextResponse.json({ error: 'Expected current report correlation and a bounded rework reason' }, { status: 400 });
    }
    const claim = await claimPaidRework({ readingId: Number(id), expectedReportId: body.expectedReportId,
      reportId: crypto.randomUUID(), actorId: Number(user.id), reason: body.reason.trim() });
    if (claim.outcome !== 'claimed') return NextResponse.json({ error: claim.outcome }, { status: claim.outcome === 'not_entitled' ? 402 : 409 });
    try {
      const dispatched = await dispatchReport({ reportId: claim.reportId, reportType: claim.reportType as ReportType,
        tier: 'paid', birthData: claim.snapshot.birthData, verifiedFacts: claim.snapshot.verifiedFacts,
        promptSlug: '', callbackUrl: process.env.CSG_REPORT_CALLBACK_URL });
      if (!dispatched.ok) throw new Error('Dispatch not confirmed');
    } catch {
      // A timeout/5xx does not prove non-delivery. Keep the attempt fenced and
      // require authenticated terminal execution evidence; never blindly retry.
      return NextResponse.json({ error: 'Dispatch unconfirmed; inspect pipeline execution before recovery', readingId: Number(id), reportId: claim.reportId }, { status: 502 });
    }
    return NextResponse.json({ success: true, status: 'queued', readingId: Number(id), reportId: claim.reportId });
  } catch {
    return NextResponse.json({ error: 'Rework unavailable' }, { status: 500 });
  }
}
