describe('Stripe report checkout canonical origin', () => {
  const originalOrigin = process.env.CSG_REPORT_CHECKOUT_ORIGIN;
  const originalAllowlist = process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS;

  afterEach(() => {
    jest.resetModules();
    if (originalOrigin === undefined) delete process.env.CSG_REPORT_CHECKOUT_ORIGIN;
    else process.env.CSG_REPORT_CHECKOUT_ORIGIN = originalOrigin;
    if (originalAllowlist === undefined) delete process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS;
    else process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS = originalAllowlist;
  });

  it('defaults to the production canonical origin', () => {
    delete process.env.CSG_REPORT_CHECKOUT_ORIGIN;
    delete process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS;
    const { resolveReportCheckoutOrigin } = require('@/lib/billing/reportPurchase');
    expect(resolveReportCheckoutOrigin()).toBe('https://cosmicspiritguide.com');
  });

  it('accepts a configured origin only when explicitly allowlisted', () => {
    process.env.CSG_REPORT_CHECKOUT_ORIGIN = 'https://csg-staging.example.com/';
    process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS = 'https://csg-staging.example.com';
    const { resolveReportCheckoutOrigin } = require('@/lib/billing/reportPurchase');
    expect(resolveReportCheckoutOrigin()).toBe('https://csg-staging.example.com');
  });

  it('rejects an unallowlisted or non-HTTPS configured origin', () => {
    process.env.CSG_REPORT_CHECKOUT_ORIGIN = 'https://attacker.invalid';
    delete process.env.CSG_REPORT_CHECKOUT_ALLOWED_ORIGINS;
    let mod = require('@/lib/billing/reportPurchase');
    expect(() => mod.resolveReportCheckoutOrigin()).toThrow(/allowlist/i);

    jest.resetModules();
    process.env.CSG_REPORT_CHECKOUT_ORIGIN = 'http://cosmicspiritguide.com';
    mod = require('@/lib/billing/reportPurchase');
    expect(() => mod.resolveReportCheckoutOrigin()).toThrow(/https/i);
  });
});
