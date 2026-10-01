import { PRODUCT_CATALOG } from '@/lib/productCatalog';

describe('Tarot public commerce contract', () => {
  test.each([
    ['celtic-cross-tarot', 'Celtic Cross Tarot'],
    ['relationship-dynamics-tarot', 'Relationship Dynamics Tarot'],
    ['career-crossroads-tarot', 'Career Crossroads Tarot'],
  ] as const)('%s is a one-time $4.99 Whop product', (id, displayName) => {
    const product = PRODUCT_CATALOG[id];
    expect(product.displayName).toBe(displayName);
    expect(product.priceCents).toBe(499);
    expect(product.whopPlanId).toMatch(/^plan_/);
    expect(product.checkoutDestination).toContain(product.whopPlanId);
  });
});
