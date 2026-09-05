import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReportPurchaseBySession, getReportPurchaseByUserIdAndType, getReportPurchase, isValidPurchaseId } from '@/lib/billing/reportPurchaseStore';
import { verifyPurchasePaidViaStripe } from '@/lib/billing/reportPurchase';

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
  let body: any;
  try {
    body = await request.json();
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

  // Step 3: SKU gate. Resume must only work for loveblueprint.
  if (purchase.reportType !== 'loveblueprint') {
    return NextResponse.json({ error: 'This session is not for a Love Blueprint purchase.' }, { status: 403 });
  }

  // Step 4: paid-status gate. Re-verify via Stripe, never trust stored flags alone.
  const verified = await verifyPurchasePaidViaStripe(purchase.purchaseId);
  if (!verified) {
    return NextResponse.json({ error: 'Purchase has not been paid yet.' }, { status: 402 });
  }

  return NextResponse.json({
    purchaseId: verified.purchaseId,
    reportType: verified.reportType,
  });
}
