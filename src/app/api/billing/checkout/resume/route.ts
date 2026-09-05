import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReportPurchaseBySession } from '@/lib/billing/reportPurchaseStore';
import { verifyPurchasePaidViaStripe } from '@/lib/billing/reportPurchase';

const MAX_BODY_BYTES = 50_000;

/**
 * POST /api/billing/checkout/resume
 *
 * Secure post-checkout return path. The client never trusts a client-supplied
 * purchaseId alone: the resume route recomputes entitlement from the Stripe
 * Checkout Session id that Stripe embeds in the success_url.
 *
 * Required body: { sessionId: string }
 *
 * Verifies:
 *   - authenticated user (auth_token cookie)
 *   - sessionId maps to a real purchase in our DB
 *   - the authenticated user OWNS that purchase (userId match)
 *   - the purchase is for a loveblueprint SKU (report-loveblueprint)
 *   - Stripe confirms payment (payment_status paid / payment_intent succeeded)
 *
 * Returns: { purchaseId, reportType } on success.
 *          401 / 400 / 403 / 404 / 402 on failure.
 */
export async function POST(request: NextRequest) {
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

  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const decoded = verifyToken(token);
  if (!decoded) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const user = await getUserById(String(decoded.userId));
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Step 1: find the purchase via the session id (server-side correlation).
  const purchase = await getReportPurchaseBySession(sessionId);
  if (!purchase) {
    return NextResponse.json({ error: 'No purchase found for this session.' }, { status: 404 });
  }

  // Step 2: ownership gate. Never trust client-supplied user identity.
  if (Number(purchase.userId) !== Number(decoded.userId)) {
    return NextResponse.json({ error: 'This purchase does not belong to your account.' }, { status: 403 });
  }

  // Step 3: exact product gate. Both type and SKU must identify Love Blueprint.
  if (purchase.reportType !== 'loveblueprint' || purchase.sku !== 'report-loveblueprint') {
    return NextResponse.json({ error: 'This session is not for a Love Blueprint purchase.' }, { status: 403 });
  }

  // Step 4: paid-status gate. Re-verify via Stripe, never trust stored flags alone.
  const verified = await verifyPurchasePaidViaStripe(purchase.purchaseId);
  if (!verified) {
    return NextResponse.json({ error: 'Purchase has not been paid yet.' }, { status: 402 });
  }
  if (verified.reportType !== 'loveblueprint' || verified.sku !== 'report-loveblueprint') {
    return NextResponse.json({ error: 'Verified purchase is not a Love Blueprint entitlement.' }, { status: 403 });
  }

  return NextResponse.json({
    purchaseId: verified.purchaseId,
    reportType: verified.reportType,
  });
}
