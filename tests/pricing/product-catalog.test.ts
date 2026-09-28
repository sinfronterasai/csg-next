import { ACTIVE_PRODUCT_IDS, PAID_PRODUCT_IDS, PRODUCT_CATALOG, getProduct } from '@/lib/productCatalog';
import { REPORT_META } from '@/lib/reportEngine';
import fs from 'node:fs';
import path from 'node:path';

const expectedPrices = {
  natalpremium: 3900,
  loveblueprint: 3900,
  transit: 4900,
  vocation: 5500,
  'celtic-cross-tarot': 499,
  'relationship-dynamics-tarot': 499,
  'career-crossroads-tarot': 499,
} as const;

describe('canonical active product catalog', () => {
  it('has exactly one complete record for every actively sellable product', () => {
    for (const id of PAID_PRODUCT_IDS) {
      const product = getProduct(id);
      expect(product.id).toBe(id);
      expect(product.displayName).toBeTruthy();
      expect(Number.isInteger(product.priceCents)).toBe(true);
      expect(product.priceCents).toBeGreaterThanOrEqual(0);
      expect(product.currency).toBe('usd');
      expect(product.formattedPrice).toMatch(/^\$\d+(\.\d{2})?$/);
      expect(product.launchStatus).toBe('active');
      if (product.priceCents > 0) {
        expect(product.whopOfferId).toBeTruthy();
        expect(product.whopPlanId).toMatch(/^plan_/);
        expect(product.checkoutDestination).toMatch(/^https:\/\/whop\.com\/checkout\/plan_/);
        expect(product.entitlementKey).toBeTruthy();
      }
    }
  });

  it('locks the approved active prices', () => {
    for (const [id, priceCents] of Object.entries(expectedPrices)) {
      expect(getProduct(id as keyof typeof PRODUCT_CATALOG).priceCents).toBe(priceCents);
    }
  });

  it('keeps current report metadata aligned with the catalog', () => {
    for (const reportType of ['natalpremium', 'loveblueprint', 'transit', 'vocation'] as const) {
      expect(REPORT_META[reportType].price * 100).toBe(getProduct(reportType).priceCents);
      expect(REPORT_META[reportType].title).toBe(getProduct(reportType).displayName);
    }
  });

  it('does not activate legacy report definitions', () => {
    expect(ACTIVE_PRODUCT_IDS).not.toContain('synastry');
    expect(ACTIVE_PRODUCT_IDS).not.toContain('lovetiming');
    expect(ACTIVE_PRODUCT_IDS).not.toContain('composite');
    expect(ACTIVE_PRODUCT_IDS).not.toContain('couples');
    expect(ACTIVE_PRODUCT_IDS).not.toContain('karmicshadow');
    expect(ACTIVE_PRODUCT_IDS).not.toContain('fullcosmic');
  });

  it('prevents live UI surfaces from carrying independent price literals', () => {
    const surfaces = [
      'src/app/reports/ReportsView.tsx',
      'src/app/tarot/pricing/page.tsx',
      'src/app/pricing/page.tsx',
      'src/app/services/page.tsx',
      'src/app/terms/page.tsx',
      'src/components/Services.tsx',
      'src/components/SiteHeader.tsx',
      'src/components/tarot/QuestionModal.tsx',
      'src/lib/tarot/spreads.ts',
    ];
    const priceLiteral = /\$(?:39|49|55)(?:\.00)?|\$4\.99/;
    for (const relativePath of surfaces) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
      expect(source).not.toMatch(priceLiteral);
    }
  });
});
