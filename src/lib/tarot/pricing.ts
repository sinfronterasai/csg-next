import type { Tier } from "@/lib/tarot/spreads";

export interface TierInfo {
  tier: Tier;
  name: string;
  priceMonthly: number;
  blurb: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

/** Resolved pricing/feature matrix (per 2026-08-03 tier decision). */
export function tierFeatureMatrix(): TierInfo[] {
  return [
    {
      tier: "free",
      name: "Free",
      priceMonthly: 0,
      blurb: "A taste of the cards, no account cost.",
      features: [
        "One Card reading",
        "Past · Present · Future reading",
        "Save your readings",
      ],
      cta: "Start free",
    },
    {
      tier: "premium",
      name: "Premium",
      priceMonthly: 4.99,
      blurb: "The full core tarot experience.",
      highlighted: true,
      features: [
        "Everything in Free",
        "Celtic Cross (10-card deep dive)",
        "Relationship Dynamics",
        "Career Crossroads",
        "Astrology-blended readings (your birth chart)",
      ],
      cta: "Upgrade to Premium",
    },
    {
      tier: "premium_plus",
      name: "Premium Plus",
      priceMonthly: 9.99,
      blurb: "Tarot fused with your living sky.",
      features: [
        "Everything in Premium",
        "Tarot + Birth Chart spreads",
        "Tarot + Current Transits",
        "Year Ahead & Soulmate spreads",
        "PDF export & reflection journal",
      ],
      cta: "Go Premium Plus",
    },
  ];
}
