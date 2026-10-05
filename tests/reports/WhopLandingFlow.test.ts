import fs from 'node:fs';
import path from 'node:path';

describe('Whop landing-page handoff', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/reports/ReportsView.tsx'), 'utf8');

  it('uses the active Whop catalog and preserves the selected product through auth/chart gates', () => {
    expect(source).toContain("import { WHOP_CHECKOUT_URLS } from '@/lib/whopCatalog';");
    expect(source).toContain("fetch('/api/auth/user'");
    expect(source).toContain("fetch('/api/birth-chart'");
    expect(source).toContain("/login?returnTo=");
    expect(source).toContain("/birth-chart?returnTo=");
    expect(source).toContain('WHOP_CHECKOUT_URLS[product.whopOffer]');
    expect(source).toContain('product=');
  });

  it.each([
    ['premium_natal_report', 'plan_oazEpfS5z5Gud'],
    ['yearly_transit_forecast', 'plan_yspM7Upl5CsPM'],
    ['vocation_wealth_map', 'plan_H6o8FSjDvpw7Y'],
  ])('keeps the %s Whop offer mapped to %s', (offer, plan) => {
    const catalog = fs.readFileSync(path.join(process.cwd(), 'src/lib/whopCatalog.ts'), 'utf8');
    expect(catalog).toContain(`${offer}: 'https://whop.com/checkout/${plan}'`);
  });
});
