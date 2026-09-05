import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { createReportCheckoutSession, isPaidReportType } from '@/lib/billing/reportPurchase';
import { gateCheckout } from '@/lib/launch/allowlist';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';
import { getReportPurchaseByUserIdAndType } from '@/lib/billing/reportPurchaseStore';

const PIPELINE_PAID: ReportType[] = ['transit', 'loveblueprint', 'lovetiming', 'vocation', 'karmicshadow', 'fullcosmic'];
const MAX_BODY_BYTES = 50_000;

export async function POST(request: NextRequest) {
  // #6 — enforce actual payload size regardless of (or absent) Content-Length.
  const raw = await request.text().catch(() => '');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const decoded = verifyToken(token);
  if (!decoded) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const reportType = body.reportType as ReportType;
  // Launch allowlist gate (L3): server-authoritative. Rejects non-launch types.
  // Love Blueprint is now publicly available; no beta allowlist check.
  // Client-supplied `tier` is NOT consulted, so it cannot downgrade or unlock a product.
  const gate = gateCheckout(reportType, String(decoded.userId));
  if (!gate.allowed) {
    return NextResponse.json({ error: 'Report type is not available at this time.' }, { status: 404 });
  }
  if (!isPaidReportType(reportType)) {
    return NextResponse.json({ error: 'Report type is not a paid report.' }, { status: 400 });
  }

  const user = await getUserById(String(decoded.userId));
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // #X — already-purchased detection: a paid buyer who lands back on /reports
  // must NOT be forced to create a second Stripe checkout. Return the existing
  // purchaseId so the resume path can re-attach entitlement without a new charge.
  const existing = await getReportPurchaseByUserIdAndType(user.id, reportType);
  if (existing) {
    return NextResponse.json({
      purchaseId: existing.purchaseId,
      reportType,
      alreadyPurchased: true,
    });
  }

  try {
    const { url, purchaseId, sessionId, existingStatus } = await createReportCheckoutSession({
      userId: user.id,
      reportType,
      email: user.email,
    });
    if (purchaseId && (existingStatus === 'paid' || existingStatus === 'consumed')) {
      return NextResponse.json({ purchaseId, reportType, alreadyPurchased: true });
    }
    if (purchaseId && existingStatus === 'pending') {
      return NextResponse.json(
        { error: 'A checkout is already in progress for this report.', purchaseId, checkoutInProgress: true },
        { status: 409 },
      );
    }
    if (!url || !purchaseId) {
      return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 502 });
    }
    return NextResponse.json({ url, purchaseId, sessionId, reportType, amount: REPORT_META[reportType].price });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Checkout failed.' }, { status: 502 });
  }
}
