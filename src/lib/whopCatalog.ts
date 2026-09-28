import { PAID_PRODUCT_IDS, PRODUCT_CATALOG } from '@/lib/productCatalog';

export const WHOP_PLAN_TO_OFFER = Object.fromEntries(
  PAID_PRODUCT_IDS.map((id) => {
    const product = PRODUCT_CATALOG[id];
    return [product.whopPlanId, product.whopOfferId];
  }),
) as {
  readonly plan_oazEpfS5z5Gud: 'premium_natal_report';
  readonly plan_CCmKCXfGGPpvo: 'love_blueprint';
  readonly plan_yspM7Upl5CsPM: 'yearly_transit_forecast';
  readonly plan_H6o8FSjDvpw7Y: 'vocation_wealth_map';
  readonly plan_uk5Oa0Ck3Xfku: 'celtic_cross';
  readonly plan_FojHN8WK5oMKA: 'relationship_dynamics';
  readonly plan_Z15jdqRtkKdrS: 'career_crossroads';
};

export const WHOP_CHECKOUT_URLS = Object.fromEntries(
  PAID_PRODUCT_IDS.map((id) => {
    const product = PRODUCT_CATALOG[id];
    return [product.whopOfferId, product.checkoutDestination];
  }),
) as {
  readonly premium_natal_report: 'https://whop.com/checkout/plan_oazEpfS5z5Gud';
  readonly love_blueprint: 'https://whop.com/checkout/plan_CCmKCXfGGPpvo';
  readonly yearly_transit_forecast: 'https://whop.com/checkout/plan_yspM7Upl5CsPM';
  readonly vocation_wealth_map: 'https://whop.com/checkout/plan_H6o8FSjDvpw7Y';
  readonly celtic_cross: 'https://whop.com/checkout/plan_uk5Oa0Ck3Xfku';
  readonly relationship_dynamics: 'https://whop.com/checkout/plan_FojHN8WK5oMKA';
  readonly career_crossroads: 'https://whop.com/checkout/plan_Z15jdqRtkKdrS';
};
