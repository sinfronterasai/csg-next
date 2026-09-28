export type ProductId =
  | 'natal'
  | 'natalpremium'
  | 'loveblueprint'
  | 'transit'
  | 'vocation'
  | 'celtic-cross-tarot'
  | 'relationship-dynamics-tarot'
  | 'career-crossroads-tarot';

export type ProductCatalogEntry = {
  readonly id: ProductId;
  readonly displayName: string;
  readonly priceCents: number;
  readonly currency: 'usd';
  readonly formattedPrice: string;
  readonly reportType?: string;
  readonly sku?: string;
  readonly whopOfferId?: string;
  readonly whopPlanId?: string;
  readonly checkoutDestination?: string;
  readonly entitlementKey?: string;
  readonly reportRoute: '/reports' | '/tarot/pricing' | '/birth-chart';
  readonly launchStatus: 'active';
};

function formatUsd(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

function paidProduct(
  entry: Omit<ProductCatalogEntry, 'currency' | 'formattedPrice' | 'launchStatus'>,
): ProductCatalogEntry {
  return {
    ...entry,
    currency: 'usd',
    formattedPrice: formatUsd(entry.priceCents),
    launchStatus: 'active',
  };
}

export const PRODUCT_CATALOG = {
  natal: {
    id: 'natal',
    displayName: 'Birth Chart Report',
    priceCents: 0,
    currency: 'usd',
    formattedPrice: 'Free',
    reportType: 'natal',
    reportRoute: '/birth-chart',
    launchStatus: 'active',
  },
  natalpremium: paidProduct({
    id: 'natalpremium',
    displayName: 'Premium Natal Report',
    priceCents: 3900,
    reportType: 'natalpremium',
    sku: 'report-natalpremium',
    whopOfferId: 'premium_natal_report',
    whopPlanId: 'plan_oazEpfS5z5Gud',
    checkoutDestination: 'https://whop.com/checkout/plan_oazEpfS5z5Gud',
    entitlementKey: 'premium_natal_report',
    reportRoute: '/reports',
  }),
  loveblueprint: paidProduct({
    id: 'loveblueprint',
    displayName: 'Love Blueprint',
    priceCents: 3900,
    reportType: 'loveblueprint',
    sku: 'report-loveblueprint',
    whopOfferId: 'love_blueprint',
    whopPlanId: 'plan_CCmKCXfGGPpvo',
    checkoutDestination: 'https://whop.com/checkout/plan_CCmKCXfGGPpvo',
    entitlementKey: 'love_blueprint',
    reportRoute: '/reports',
  }),
  transit: paidProduct({
    id: 'transit',
    displayName: 'Yearly Transit Forecast',
    priceCents: 4900,
    reportType: 'transit',
    sku: 'report-transit',
    whopOfferId: 'yearly_transit_forecast',
    whopPlanId: 'plan_yspM7Upl5CsPM',
    checkoutDestination: 'https://whop.com/checkout/plan_yspM7Upl5CsPM',
    entitlementKey: 'yearly_transit_forecast',
    reportRoute: '/reports',
  }),
  vocation: paidProduct({
    id: 'vocation',
    displayName: 'Vocation & Wealth Map',
    priceCents: 5500,
    reportType: 'vocation',
    sku: 'report-vocation',
    whopOfferId: 'vocation_wealth_map',
    whopPlanId: 'plan_H6o8FSjDvpw7Y',
    checkoutDestination: 'https://whop.com/checkout/plan_H6o8FSjDvpw7Y',
    entitlementKey: 'vocation_wealth_map',
    reportRoute: '/reports',
  }),
  'celtic-cross-tarot': paidProduct({
    id: 'celtic-cross-tarot',
    displayName: 'Celtic Cross Tarot',
    priceCents: 499,
    whopOfferId: 'celtic_cross',
    whopPlanId: 'plan_uk5Oa0Ck3Xfku',
    checkoutDestination: 'https://whop.com/checkout/plan_uk5Oa0Ck3Xfku',
    entitlementKey: 'celtic_cross',
    reportRoute: '/tarot/pricing',
  }),
  'relationship-dynamics-tarot': paidProduct({
    id: 'relationship-dynamics-tarot',
    displayName: 'Relationship Dynamics Tarot',
    priceCents: 499,
    whopOfferId: 'relationship_dynamics',
    whopPlanId: 'plan_FojHN8WK5oMKA',
    checkoutDestination: 'https://whop.com/checkout/plan_FojHN8WK5oMKA',
    entitlementKey: 'relationship_dynamics',
    reportRoute: '/tarot/pricing',
  }),
  'career-crossroads-tarot': paidProduct({
    id: 'career-crossroads-tarot',
    displayName: 'Career Crossroads Tarot',
    priceCents: 499,
    whopOfferId: 'career_crossroads',
    whopPlanId: 'plan_Z15jdqRtkKdrS',
    checkoutDestination: 'https://whop.com/checkout/plan_Z15jdqRtkKdrS',
    entitlementKey: 'career_crossroads',
    reportRoute: '/tarot/pricing',
  }),
} as const satisfies Record<ProductId, ProductCatalogEntry>;

export const ACTIVE_PRODUCT_IDS = Object.keys(PRODUCT_CATALOG) as ProductId[];
export const PAID_PRODUCT_IDS = [
  'natalpremium',
  'loveblueprint',
  'transit',
  'vocation',
  'celtic-cross-tarot',
  'relationship-dynamics-tarot',
  'career-crossroads-tarot',
] as const;

export function getProduct<T extends ProductId>(id: T): (typeof PRODUCT_CATALOG)[T] {
  return PRODUCT_CATALOG[id];
}
