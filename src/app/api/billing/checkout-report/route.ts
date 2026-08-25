import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { createReportCheckoutSession, isPaidReportType } from '@/lib/billing/reportPurchase';
import { REPORT_META, type ReportType } from '@/lib/reportEngine';

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
  if (!PIPELINE_PAID.includes(reportType)) {
    return NextResponse.json({ error: 'Report type does not require purchase.' }, { status: 400 });
  }
  if (!isPaidReportType(reportType)) {
    return NextResponse.json({ error: 'Report type is not a paid report.' }, { status: 400 });
  }

  const user = await getUserById(String(decoded.userId));
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  try {
    const origin = request.nextUrl.origin;
    const { url, purchaseId } = await createReportCheckoutSession({
      userId: user.id,
      reportType,
      email: user.email,
      origin,
    });
    if (!url || !purchaseId) {
      return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 502 });
    }
    return NextResponse.json({ url, purchaseId, amount: REPORT_META[reportType].price });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Checkout failed.' }, { status: 502 });
  }
}
