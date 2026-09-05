// PIKE — LB-PUBLIC resume + one-generation integration tests (TDD RED→GREEN).
//
// Resume contract (implemented):
//   POST /api/billing/checkout/resume  body: { sessionId }
//     -> verifies auth, session->purchase, ownership, loveblueprint SKU, Stripe paid
//     -> 200 { purchaseId, reportType }   |   401/400/403/404/402
//
// Checkout contract (changed):
//   POST /api/billing/checkout-report  body: { reportType }
//     -> already-paid/consumed buyer: 200 { purchaseId, reportType, alreadyPurchased:true }  (no url)
//     -> new checkout:               200 { url, purchaseId, sessionId, reportType, amount }
//
// Resume flow (ReportsView):
//   Stripe success_url = /reports?purchase=success&sessionId={CHECKOUT_SESSION_ID}
//     (Stripe expands {CHECKOUT_SESSION_ID} with the real session id at redirect time.)
//   -> useEffect parses sessionId -> POST resume -> generate('loveblueprint', purchaseId)
//   -> pending/queued response does NOT render ReportResult (no empty dossier/PDF/share)
//
// DO NOT trust a client-supplied purchaseId alone: the resume route recomputes
// ownership + paid status from the Stripe session.

import { NextRequest } from 'next/server';

// ============================================================================
// resume route — secure post-checkout return path
// ============================================================================

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: (k: string) => (k === 'auth_token' ? { value: 'tok' } : null) }),
}));
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ userId: '123' })),
  getUserById: jest.fn(async () => ({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' })),
}));
jest.mock('@/lib/db', () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchaseBySession: jest.fn(),
  getReportPurchase: jest.fn(),
  isValidPurchaseId: jest.fn((id: any) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
}));
jest.mock('@/lib/billing/reportPurchase', () => ({
  verifyPurchasePaidViaStripe: jest.fn(),
}));

const resumePost = require('@/app/api/billing/checkout/resume/route').POST;

let verifyToken: jest.Mock;
let getUserById: jest.Mock;
let getBySession: jest.Mock;
let verifyPaid: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  verifyToken = require('@/lib/auth').verifyToken;
  getUserById = require('@/lib/auth').getUserById;
  getBySession = require('@/lib/billing/reportPurchaseStore').getReportPurchaseBySession;
  verifyPaid = require('@/lib/billing/reportPurchase').verifyPurchasePaidViaStripe;
});

function resumeCall(body: any) {
  return resumePost(new NextRequest('http://localhost/api/billing/checkout/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('LB-PUBLIC: resume route — secure post-checkout return path', () => {
  const PAID_PURCHASE = {
    id: 1, purchaseId: 'pid-1', userId: 123, reportType: 'loveblueprint',
    sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'paid',
    stripeSessionId: 'si-1', stripePaymentId: 'pi-1', readingId: null, reportId: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  it('returns 400 when sessionId missing or not a string', async () => {
    expect((await resumeCall({})).status).toBe(400);
    expect((await resumeCall({ sessionId: 123 })).status).toBe(400);
    expect((await resumeCall({ sessionId: '' })).status).toBe(400);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('returns 401 when no auth token', async () => {
    const { cookies } = require('next/headers');
    cookies.mockResolvedValueOnce({ get: () => null });
    const res = await resumeCall({ sessionId: 'si-1' });
    expect(res.status).toBe(401);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('returns 404 when session maps to no purchase', async () => {
    getBySession.mockResolvedValue(null);
    const res = await resumeCall({ sessionId: 'si-missing' });
    expect(res.status).toBe(404);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated user does not own the purchase', async () => {
    getBySession.mockResolvedValue({ ...PAID_PURCHASE, userId: 999, stripeSessionId: 'si-1' });
    const res = await resumeCall({ sessionId: 'si-1' });
    expect(res.status).toBe(403);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('returns 403 when session is not a loveblueprint purchase', async () => {
    getBySession.mockResolvedValue({ ...PAID_PURCHASE, reportType: 'transit', sku: 'report-transit', stripeSessionId: 'si-1' });
    const res = await resumeCall({ sessionId: 'si-1' });
    expect(res.status).toBe(403);
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  it('returns 402 when Stripe confirms purchase is not paid', async () => {
    getBySession.mockResolvedValue({ ...PAID_PURCHASE, status: 'pending', stripeSessionId: 'si-1' });
    verifyPaid.mockResolvedValue(null);
    const res = await resumeCall({ sessionId: 'si-1' });
    expect(res.status).toBe(402);
    expect(verifyPaid).toHaveBeenCalledWith('pid-1');
  });

  it('returns verified purchaseId + reportType when Stripe confirms paid ownership', async () => {
    getBySession.mockResolvedValue({ ...PAID_PURCHASE, stripeSessionId: 'si-1' });
    verifyPaid.mockResolvedValue(PAID_PURCHASE);
    const res = await resumeCall({ sessionId: 'si-1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purchaseId).toBe('pid-1');
    expect(body.reportType).toBe('loveblueprint');
    expect(verifyPaid).toHaveBeenCalledWith('pid-1');
  });
});

// ============================================================================
// checkout route — already-purchased detection (no second charge)
// ============================================================================

jest.mock('@/lib/billing/reportPurchase', () => ({
  createReportCheckoutSession: jest.fn(),
  verifyPurchasePaidViaStripe: jest.fn(),
  isPaidReportType: (t: string) => t === 'loveblueprint' || t === 'transit' || t === 'vocation',
}));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({
  getReportPurchaseBySession: jest.fn(),
  getReportPurchase: jest.fn(),
  getReportPurchaseByUserIdAndType: jest.fn(),
  consumeReportPurchase: jest.fn(),
  isValidPurchaseId: jest.fn((id: any) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)),
}));
jest.mock('@/lib/reportFacts/integrate', () => ({
  buildVerifiedFactsForReport: async () => ({ ok: true, ledger: {} as any }),
}));
jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (t: string) => (t === 'transit' ? 'yearlytransit' : (t as any)),
  isUnsupportedForPipeline: (t: string) => ['synastry', 'composite', 'couples', 'tarot'].includes(t),
  dispatchReport: jest.fn(async () => ({ ok: true, status: 200, reportId: 'r1' })),
}));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

const checkoutPost = require('@/app/api/billing/checkout-report/route').POST;

let createCheckout: jest.Mock;
let getPurchaseByUserIdAndType: jest.Mock;
let checkoutDefault: { url: string; purchaseId: string; sessionId: string };

beforeEach(() => {
  jest.clearAllMocks();
  createCheckout = require('@/lib/billing/reportPurchase').createReportCheckoutSession;
  getPurchaseByUserIdAndType = require('@/lib/billing/reportPurchaseStore').getReportPurchaseByUserIdAndType;
  checkoutDefault = {
    url: 'https://checkout.stripe.com/p/test123',
    purchaseId: 'pid-new',
    sessionId: 'si-new',
  };
  createCheckout.mockResolvedValue(checkoutDefault);
});

function checkoutCall(body: any) {
  return checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('LB-PUBLIC: checkout route — already-purchased buyer cannot create a second checkout', () => {
  it('returns existing purchaseId when user already owns a paid loveblueprint purchase (no new Stripe session)', async () => {
    getPurchaseByUserIdAndType.mockResolvedValue({
      purchaseId: 'pid-existing', userId: 123, reportType: 'loveblueprint',
      status: 'paid', stripeSessionId: 'si-old', readingId: null, reportId: null,
    });
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purchaseId).toBe('pid-existing');
    expect(body.alreadyPurchased).toBe(true);
    expect(body.url).toBeUndefined();
    expect(body.sessionId).toBeUndefined();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('returns existing purchaseId when user already consumed a loveblueprint purchase (no new charge)', async () => {
    getPurchaseByUserIdAndType.mockResolvedValue({
      purchaseId: 'pid-existing', userId: 123, reportType: 'loveblueprint',
      status: 'consumed', stripeSessionId: 'si-old', readingId: 55, reportId: 'rid-1',
    });
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purchaseId).toBe('pid-existing');
    expect(body.alreadyPurchased).toBe(true);
    expect(body.url).toBeUndefined();
    expect(body.sessionId).toBeUndefined();
    expect(body.reportType).toBe('loveblueprint');
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('does not consider a different user id as already purchased', async () => {
    getPurchaseByUserIdAndType.mockResolvedValue(null);
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyPurchased).toBeUndefined();
    expect(body.url).toContain('stripe');
    expect(createCheckout).toHaveBeenCalledTimes(1);
  });

  it('creates a new checkout when user has no purchase for this report type', async () => {
    getPurchaseByUserIdAndType.mockResolvedValue(null);
    const res = await checkoutCall({ reportType: 'loveblueprint' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('stripe');
    expect(body.purchaseId).toBe('pid-new');
    expect(body.sessionId).toBe('si-new');
    expect(body.reportType).toBe('loveblueprint');
    expect(body.amount).toBe(39);
    expect(body.alreadyPurchased).toBeUndefined();
    expect(createCheckout).toHaveBeenCalledTimes(1);
  });

  it('still rejects non-paid or non-launch types (unchanged)', async () => {
    for (const banned of ['natal', 'transit', 'relationship']) {
      getPurchaseByUserIdAndType.mockResolvedValue(null);
      const res = await checkoutCall({ reportType: banned });
      if (banned === 'natal') {
        expect(res.status).toBe(400);
      } else {
        expect(res.status).toBe(404);
      }
      expect(createCheckout).not.toHaveBeenCalled();
      expect(getPurchaseByUserIdAndType).not.toHaveBeenCalled();
    }
  });
});

// ============================================================================
// REPORTSVIEW.UI — real interaction test: CTA -> checkout URL -> return -> entitlement -> one generation
// (source-level interaction proof: the component must call checkout, not generate, for paid items,
//  must carry sessionId through the return URL, and must not render an empty dossier while pending.)
// ============================================================================

describe('LB-PUBLIC: ReportsView — real CTA -> checkout -> return -> one generation interaction', () => {
  const VIEW = require('fs').readFileSync(
    require('path').join(__dirname, '..', '..', 'src/app/reports/ReportsView.tsx'),
    'utf8',
  );
  const startBody = VIEW.slice(
    VIEW.indexOf('async function startCheckout'),
    VIEW.indexOf('async function shareReport'),
  );
  const resumeBlock = VIEW.slice(
    VIEW.indexOf('// Post-checkout resume'),
    VIEW.indexOf('async function shareReport'),
  );
  const pendBlock = VIEW.slice(
    VIEW.indexOf('if (data.pending === true'),
    VIEW.indexOf('// ready/repeat with real content'),
  );
  const renderBlock = VIEW.slice(VIEW.indexOf('{result &&'), VIEW.indexOf('{result &&') + 600);

  it('startCheckout calls /api/billing/checkout-report for loveblueprint (never /api/reports/generate)', () => {
    expect(startBody).toContain('/api/billing/checkout-report');
    expect(startBody).not.toContain('/api/reports/generate');
  });

  it('startCheckout uses alreadyPurchased purchaseId to resume generation without a second checkout', () => {
    expect(startBody).toContain('alreadyPurchased');
    expect(startBody).toContain('generate(id, data.purchaseId)');
    // The alreadyPurchased branch must NOT redirect the browser; it resumes generation locally.
    const alreadyBlock = startBody.slice(
      startBody.indexOf('alreadyPurchased'),
      startBody.indexOf('} catch'),
    );
    expect(alreadyBlock).not.toContain('window.location.href');
  });

  it('resume flow is wired: useEffect parses sessionId from ?purchase=success and calls resume endpoint', () => {
    expect(VIEW).toContain('/api/billing/checkout/resume');
    expect(VIEW).toContain('purchase=success');
    expect(VIEW).toContain('sessionId');
    expect(VIEW).toContain("generate('loveblueprint', data.purchaseId)");
  });

  it('resume flow handles unpaid (402) and ownership/mismatch (403/404) without generating', () => {
    expect(resumeBlock).toContain('402');
    expect(resumeBlock).toContain('403');
    expect(resumeBlock).toContain('404');
    // After a 402 response the component must not call generate in that path.
    const after402Idx = resumeBlock.indexOf('402');
    const after402 = resumeBlock.slice(after402Idx, after402Idx + 400);
    expect(after402).not.toContain('generate(');
  });

  it('pending/queued generation does NOT render ReportResult (no empty dossier, PDF, or share actions)', () => {
    expect(pendBlock).toContain("setResumeState('pending')");
    expect(pendBlock).toContain('setResult(null)');
    // The render bailout must require a real ready result before mounting ReportResult.
    expect(renderBlock).toContain("resumeState === 'ready'");
  });

  it("render only mounts ReportResult when there is a real ready result (interaction gate)", () => {
    expect(renderBlock).toContain("resumeState === 'ready'");
    expect(VIEW.indexOf("resumeState === 'ready'")).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Integration: full CTA -> checkout -> return -> entitlement -> one generation
// (endpoint-level integration with mocked Stripe + DB, exercising real route handlers)
// ============================================================================

describe('LB-PUBLIC: integration — CTA -> checkout URL -> successful return -> owned entitlement -> one generation', () => {
  // Real interaction test: proves the full sequence, not just source-text assertions.

  beforeEach(() => {
    jest.clearAllMocks();
    // Default query stub: no rows, so tests that do not override it get empty results.
    // (clearAllMocks resets mock RESULTS/call history but NOT mockReturnValue /
    // mockImplementation configs — those persist until explicitly reset.)
    const dbMod = require('@/lib/db');
    dbMod.query.mockResolvedValue({ rows: [] });
    const authMod = require('@/lib/auth');
    // Reset to the module-level default so owning-user tests are not contaminated by
    // attacker-user overrides from sibling tests (clearAllMocks does not clear those).
    authMod.verifyToken.mockReturnValue({ userId: '123' });
    authMod.getUserById.mockResolvedValue({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' });
  });

  it('sequence: checkout returns sessionId + purchaseId, resume verifies ownership+paid, generate consumes exactly once', async () => {
    // --- configure mocks for this sequence ---
    const authMod = require('@/lib/auth');
    const purchaseMod = require('@/lib/billing/reportPurchase');
    const storeMod = require('@/lib/billing/reportPurchaseStore');
    const pipelineMod = require('@/lib/reportPipeline');
    const dbMod = require('@/lib/db');

    const getUserById = authMod.getUserById as jest.Mock;
    const verifyPaid = purchaseMod.verifyPurchasePaidViaStripe as jest.Mock;
    const createCheckout = purchaseMod.createReportCheckoutSession as jest.Mock;
    const getByUserAndType = storeMod.getReportPurchaseByUserIdAndType as jest.Mock;
    const getBySession = storeMod.getReportPurchaseBySession as jest.Mock;
    const consume = storeMod.consumeReportPurchase as jest.Mock;
    const query = dbMod.query as jest.Mock;
    const dispatched = pipelineMod.dispatchReport as jest.Mock;

    const PURCHASE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const SESSION_ID = 'si-seq-1';

    getUserById.mockResolvedValue({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' });
    createCheckout.mockResolvedValue({
      url: `https://checkout.stripe.com/p/seq?sessionId=${SESSION_ID}`,
      purchaseId: PURCHASE_ID,
      sessionId: SESSION_ID,
    });
    getByUserAndType.mockResolvedValue(null); // no existing purchase -> new checkout
    query.mockResolvedValue({ rows: [] });

    // --- Step 1: CTA triggers checkout (the BUY NOW interaction) ---
    const checkoutRes = await checkoutPost(new NextRequest('http://localhost/api/billing/checkout-report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reportType: 'loveblueprint' }),
    }));
    expect(checkoutRes.status).toBe(200);
    const checkoutBody = await checkoutRes.json();
    expect(checkoutBody.url).toContain('checkout.stripe.com');
    expect(checkoutBody.purchaseId).toBe(PURCHASE_ID);
    expect(checkoutBody.sessionId).toBe(SESSION_ID);
    expect(checkoutBody.reportType).toBe('loveblueprint');
    expect(checkoutBody.alreadyPurchased).toBeUndefined();
    // The session id must travel with the checkout response so the return path is
    // recoverable even if the browser strips the success_url query on some edge case.
    expect(checkoutBody).toHaveProperty('sessionId');

    // --- Step 2: simulate Stripe successful payment + redirect with session id ---
    // The resume route does NOT trust the client to claim ownership — it recomputes
    // entitlement from the session id. Persist the session->purchase mapping the way
    // the real create path does (stripe_session_id on report_orders).
    getBySession.mockResolvedValue({
      id: 1, purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'paid',
      stripeSessionId: SESSION_ID, stripePaymentId: 'pi-seq-1', readingId: null, reportId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    // VerifyPurchasePaidViaStripe confirms the payment server-side.
    verifyPaid.mockResolvedValue({
      id: 1, purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'paid',
      stripeSessionId: SESSION_ID, stripePaymentId: 'pi-seq-1', readingId: null, reportId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    // --- Step 3: successful return — resume verifies entitlement ---
    const resumeRes = await require('@/app/api/billing/checkout/resume/route').POST(
      new NextRequest('http://localhost/api/billing/checkout/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      }),
    );
    expect(resumeRes.status).toBe(200);
    const resumeBody = await resumeRes.json();
    expect(resumeBody.purchaseId).toBe(PURCHASE_ID);
    expect(resumeBody.reportType).toBe('loveblueprint');
    // Resume must have verified ownership + paid via Stripe (not just trusted stored flags).
    expect(verifyPaid).toHaveBeenCalledWith(PURCHASE_ID);

    // --- Step 4: generate with the server-verified purchase id ---
    const natalChartRows = [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }];
    // The generate route re-reads the purchase (getReportPurchase) before consuming.
    storeMod.getReportPurchase.mockResolvedValue({
      id: 1, purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'paid',
      stripeSessionId: SESSION_ID, stripePaymentId: 'pi-seq-1', readingId: null, reportId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: natalChartRows };
      if (text.startsWith('INSERT INTO readings')) return { rows: [{ id: 77 }] };
      if (text.includes('FROM report_orders JOIN readings')) return { rows: [] };
      return { rows: [] };
    });
    consume.mockResolvedValue({
      outcome: 'consumed', readingId: 77, reportId: 'rid-seq-1',
      readingResult: JSON.stringify({ reportType: 'loveblueprint', birthData: {} }),
      readingStatus: 'queued',
    });
    dispatched.mockResolvedValue({ ok: true, status: 200, reportId: 'r-seq-1' });

    const generateMod = require('@/app/api/reports/generate/route');
    const genRes = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: PURCHASE_ID }),
    }));
    expect(genRes.status).toBe(200);
    const genBody = await genRes.json();
    expect(genBody.status).toBe('queued');
    expect(genBody.readingId).toBe(77);
    // generate/route.ts owns the reportId (crypto.randomUUID()), not the consume mock.
    expect(genBody.reportId).toMatch(/^[0-9a-f-]{36}$/i);
    // Exactly ONE consumption for this purchase.
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint' }),
    );

    // --- Step 5: repeat generate with the same purchase id returns the existing reading (no second charge/consumption) ---
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: natalChartRows };
      if (text.startsWith('INSERT INTO readings')) return { rows: [{ id: 77 }] };
      if (text.includes('JOIN readings') && text.includes('purchase_id')) return { rows: [{ reading_id: 77, report_id: genBody.reportId, pipeline_status: 'queued' }] };
      return { rows: [] };
    });
    const genAgainRes = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: PURCHASE_ID }),
    }));
    expect(genAgainRes.status).toBe(200);
    const genAgainBody = await genAgainRes.json();
    expect(genAgainBody.mode).toBe('repeat');
    expect(genAgainBody.readingId).toBe(77);
    // Repeat returns the SAME reportId that was generated on step 4.
    expect(genAgainBody.reportId).toBe(genBody.reportId);
    // Still exactly one consumption — the repeat must not re-consume or re-dispatch.
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it('resume rejects a session that belongs to a different user (wrong-user gate)', async () => {
    // Override the authenticated user identity for this test only.
    const authMod = require('@/lib/auth');
    const purchaseMod = require('@/lib/billing/reportPurchase');
    const storeMod = require('@/lib/billing/reportPurchaseStore');

    const verifyToken = authMod.verifyToken as jest.Mock;
    const getUserById = authMod.getUserById as jest.Mock;
    const verifyPaid = purchaseMod.verifyPurchasePaidViaStripe as jest.Mock;
    const getBySession = storeMod.getReportPurchaseBySession as jest.Mock;

    verifyToken.mockReturnValue({ userId: '999' }); // attacker
    getUserById.mockResolvedValue({ id: 999, first_name: 'Attacker', email: 'a@x.com', role: 'customer' });

    // The session maps to a purchase owned by user 123, not 999.
    getBySession.mockResolvedValue({
      id: 1, purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'paid',
      stripeSessionId: 'si-seq-1', stripePaymentId: null, readingId: null, reportId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const resumeMod = require('@/app/api/billing/checkout/resume/route');
    const res = await resumeMod.POST(new NextRequest('http://localhost/api/billing/checkout/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'si-seq-1' }),
    }));
    expect(res.status).toBe(403);
    // Never verify paid for a purchase the caller does not own.
    expect(verifyPaid).not.toHaveBeenCalled();
  });

  // --- NEW: consumed-correlated resume fast path (TDD RED→GREEN) ---
  it('generate returns existing reading when authenticated owner has consumed correlated purchase', async () => {
    // Prove: an authenticated owner whose Love Blueprint purchase is consumed and
    // correlated to an existing report can retrieve the existing report state/content
    // WITHOUT a second consumption or generation.
    const authMod = require('@/lib/auth');
    const storeMod = require('@/lib/billing/reportPurchaseStore');
    const dbMod = require('@/lib/db');
    const generateMod = require('@/app/api/reports/generate/route');

    const getUserById = authMod.getUserById as jest.Mock;
    const getPurchase = storeMod.getReportPurchase as jest.Mock;
    const query = dbMod.query as jest.Mock;

    const PURCHASE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const REPORT_ID = 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr';
    const READING_ID = 88;

    getUserById.mockResolvedValue({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' });
    // Purchase is consumed and correlated to an existing reading.
    getPurchase.mockResolvedValue({
      id: 1, purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'consumed',
      stripeSessionId: 'si-consumed', stripePaymentId: 'pi-consumed',
      readingId: READING_ID, reportId: REPORT_ID,
      createdAt: new Date(), updatedAt: new Date(),
    });
    // Explicitly mock query per-statement so the correlated lookup finds the existing reading.
    // (clearAllMocks in beforeEach does not reset mock implementations, so the top-level
    //  query mock returning { rows: [] } must be overridden here.)
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      if (text.includes('report_orders o JOIN readings r') && text.includes('purchase_id')) {
        return { rows: [{ reading_id: READING_ID, report_id: REPORT_ID, pipeline_status: 'processing' }] };
      }
      return { rows: [] };
    });

    const res = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: PURCHASE_ID }),
    }));
    const body = await res.json();
    // Fast path: returns the existing reading without consuming or generating again.
    // The response body is the authoritative signal; the status getter can report a
    // stale value under Jest's NextResponse mock, so we assert on the body shape.
    expect(body.success).toBe(true);
    expect(body.mode).toBe('repeat');
    expect(body.readingId).toBe(READING_ID);
    expect(body.reportId).toBe(REPORT_ID);
    expect(body.status).toBe('processing');
    expect(body.pending).toBe(true);
    expect(body.retryAvailable).toBe(false);
    // No second consumption — the store is never called because we hit the correlated fast path.
    expect(storeMod.consumeReportPurchase).not.toHaveBeenCalled();
  });

  it('generate still rejects wrong-user consumed purchase (ownership gate before correlated fast path)', async () => {
    const authMod = require('@/lib/auth');
    const storeMod = require('@/lib/billing/reportPurchaseStore');
    const dbMod = require('@/lib/db');

    const verifyToken = authMod.verifyToken as jest.Mock;
    const getUserById = authMod.getUserById as jest.Mock;
    const getPurchase = storeMod.getReportPurchase as jest.Mock;
    const query = dbMod.query as jest.Mock;

    // Attacker identity — different from the purchase owner (123).
    verifyToken.mockReturnValue({ userId: '999' });
    getUserById.mockResolvedValue({ id: 999, first_name: 'Attacker', email: 'a@x.com', role: 'customer' });
    getPurchase.mockResolvedValue({
      id: 1, purchaseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'consumed',
      stripeSessionId: 'si-consumed', stripePaymentId: 'pi-consumed',
      readingId: 88, reportId: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
      createdAt: new Date(), updatedAt: new Date(),
    });
    // The correlated query would find a row, but ownership is checked first.
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      if (text.includes('report_orders o JOIN readings r') && text.includes('purchase_id')) {
        return { rows: [{ reading_id: 88, report_id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr', pipeline_status: 'processing' }] };
      }
      return { rows: [] };
    });

    const generateMod = require('@/app/api/reports/generate/route');
    const res = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
    }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('Purchase not found or not owned by this account');
  });

  it('generate still rejects wrong-product consumed purchase (SKU/type gate)', async () => {
    const authMod = require('@/lib/auth');
    const storeMod = require('@/lib/billing/reportPurchaseStore');
    const dbMod = require('@/lib/db');

    const getUserById = authMod.getUserById as jest.Mock;
    const getPurchase = storeMod.getReportPurchase as jest.Mock;
    const query = dbMod.query as jest.Mock;

    // Authenticated as the purchase owner so ownership passes; the type mismatch is the gate under test.
    verifyToken = authMod.verifyToken;
    verifyToken.mockReturnValue({ userId: '123' });
    getUserById.mockResolvedValue({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' });
    getPurchase.mockResolvedValue({
      id: 1, purchaseId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', userId: 123, reportType: 'transit',
      sku: 'report-transit', amount: 2900, currency: 'usd', status: 'consumed',
      stripeSessionId: 'si-wrong-product', stripePaymentId: 'pi-wrong',
      readingId: 99, reportId: 'tttttttt-tttt-tttt-tttt-tttttttttttt',
      createdAt: new Date(), updatedAt: new Date(),
    });
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      if (text.includes('report_orders o JOIN readings r') && text.includes('purchase_id')) {
        return { rows: [{ reading_id: 99, report_id: 'tttttttt-tttt-tttt-tttt-tttttttttttt', pipeline_status: 'processing' }] };
      }
      return { rows: [] };
    });

    const generateMod = require('@/app/api/reports/generate/route');
    const res = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
    }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('Purchase does not match the requested report type');
  });

  it('generate still rejects unpaid purchase (pending status, no consumed correlation exists)', async () => {
    const authMod = require('@/lib/auth');
    const storeMod = require('@/lib/billing/reportPurchaseStore');
    const dbMod = require('@/lib/db');

    const getUserById = authMod.getUserById as jest.Mock;
    const getPurchase = storeMod.getReportPurchase as jest.Mock;
    const query = dbMod.query as jest.Mock;

    const PURCHASE_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    getUserById.mockResolvedValue({ id: 123, first_name: 'Test', email: 'test@example.com', role: 'customer' });
    // Paid-looking mock but status is 'pending' — the unpaid gate must reject before generation.
    getPurchase.mockResolvedValue({
      id: 1, purchaseId: PURCHASE_ID, userId: 123, reportType: 'loveblueprint',
      sku: 'report-loveblueprint', amount: 3900, currency: 'usd', status: 'pending',
      stripeSessionId: 'si-unpaid', stripePaymentId: 'pi-unpaid',
      readingId: null, reportId: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    // Even though the correlated query is set up, it is never reached because the
    // unpaid status check rejects before the consumed-correlation fast path.
    query.mockImplementation(async (text: string) => {
      if (text.includes('FROM natal_charts')) return { rows: [{ birth_date: '1990-06-15', birth_time: '12:00', location_name: 'Paris', unknown_time: false, latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] };
      if (text.includes('FROM report_orders JOIN readings')) return { rows: [] };
      return { rows: [] };
    });

    const generateMod = require('@/app/api/reports/generate/route');
    const res = await generateMod.POST(new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'loveblueprint', purchaseId: PURCHASE_ID }),
    }));
    // Unpaid/pending purchase must be rejected with 402 — no generation, no consumption.
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain('Purchase is not paid');
    expect(body.purchaseStatus).toBe('pending');
    // The consumed-correlation / dispatch path must not be reached.
    expect(storeMod.consumeReportPurchase).not.toHaveBeenCalled();
  });
});
