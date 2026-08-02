export interface PremiumReport {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
}

export const PREMIUM_REPORTS: PremiumReport[] = [
  {
    id: 'transit',
    name: 'Yearly Transit Forecast',
    description: 'Map planetary movements relative to your life nodes over the next 12 months.',
    priceInCents: 4900,
  },
  {
    id: 'synastry',
    name: 'Synastry Love Report',
    description: 'Overlay two charts to unlock structural compatibility, friction zones, and soul-contract links.',
    priceInCents: 6500,
  },
  {
    id: 'vocation',
    name: 'Vocation and Wealth Map',
    description: 'Decode Midheaven aspects and 2nd/10th House dynamics for perfect professional alignment.',
    priceInCents: 5500,
  },
  {
    id: 'zoom',
    name: 'Tarot and Astrological Zoom',
    description: 'A live, 60-minute virtual session with a certified cosmic high-priestess addressing career and destiny.',
    priceInCents: 12000,
  },
];

export function getPremiumReportById(id: string): PremiumReport | undefined {
  return PREMIUM_REPORTS.find((r) => r.id === id);
}
