import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { getPremiumReportById, type PremiumReport } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

// Lazily instantiate Stripe — the secret key only exists in the deployed
// environment, so importing this module must never require it.
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Payments are not configured (missing STRIPE_SECRET_KEY).');
  }
  return new Stripe(key, { apiVersion: '2023-10-16' as any });
}

async function getOrCreateReportPrice(stripe: Stripe, report: PremiumReport): Promise<string> {
  const envPriceId = process.env[`STRIPE_PRICE_ID_report_${report.id}`];
  if (envPriceId) return envPriceId;

  const products = await stripe.products.list({ limit: 100, active: true });
  const existingProduct = products.data.find(
    (p) => p.metadata && p.metadata.report_id === report.id,
  );

  if (existingProduct) {
    const prices = await stripe.prices.list({
      product: existingProduct.id,
      active: true,
      type: 'one_time',
    });
    if (prices.data.length > 0) return prices.data[0].id;
  }

  const product = await stripe.products.create({
    name: report.name,
    description: report.description,
    metadata: { report_id: report.id, report_name: report.name },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: report.priceInCents,
    currency: 'usd',
    metadata: { report_id: report.id },
  });

  return price.id;
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const reportId: string | undefined = body?.reportId;

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const report = getPremiumReportById(reportId);
    if (!report) {
      return NextResponse.json({ error: `Invalid report type: ${reportId}` }, { status: 400 });
    }

    // Auth is optional — guest checkout is allowed.
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;

    let user: any = null;
    if (decoded?.userId) {
      try {
        user = await getUserById(decoded.userId);
      } catch {
        user = null;
      }
    }

    // Authenticated users must have a saved birth chart before purchasing.
    if (user) {
      const { rows } = await query(
        'SELECT id FROM natal_charts WHERE user_id = $1 LIMIT 1',
        [user.id],
      );
      if (rows.length === 0) {
        return NextResponse.json(
          {
            error: 'You need a birth chart before purchasing a report.',
            requiresBirthChart: true,
            message: 'Please create your free birth chart first.',
          },
          { status: 400 },
        );
      }
    }

    const stripe = getStripe();

    const customer = await stripe.customers.create({
      ...(user?.email ? { email: user.email } : {}),
      metadata: {
        report_id: reportId,
        ...(user ? { userId: String(user.id) } : {}),
      },
    });
    const customerId = customer.id;

    const priceId = await getOrCreateReportPrice(stripe, report);

    const hostHeader = request.headers.get('host');
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (hostHeader ? `https://${hostHeader}` : 'http://localhost:5000');

    const metadata = {
      type: 'premium_report',
      report_id: reportId,
      report_name: report.name,
      user_id: user?.id ? String(user.id) : '',
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: { metadata },
      success_url: `${baseUrl}/reports/success?session_id={CHECKOUT_SESSION_ID}&report=${reportId}`,
      cancel_url: `${baseUrl}/reports`,
      metadata,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      reportId,
      reportName: report.name,
      price: report.priceInCents / 100,
    });
  } catch (error: any) {
    console.error('[create-report-payment] error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Unable to start checkout.' },
      { status: 500 },
    );
  }
}
