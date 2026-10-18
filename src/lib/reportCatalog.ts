export type ReportType =
  | 'natal' | 'natalpremium' | 'relationship' | 'transit' | 'loveblueprint' | 'lovetiming'
  | 'synastry' | 'composite' | 'couples' | 'vocation' | 'karmicshadow' | 'fullcosmic';

export const REPORT_META: Record<ReportType, { title: string; price: number }> = {
  natal: { title: 'Natal Birth Chart Report', price: 0 },
  natalpremium: { title: 'Premium Natal Report', price: 39 },
  relationship: { title: 'Relationship Matrix', price: 0 },
  transit: { title: 'Yearly Transit Forecast', price: 39 },
  loveblueprint: { title: 'Love Blueprint', price: 39 },
  lovetiming: { title: 'Love Timing Forecast', price: 29 },
  synastry: { title: 'Synastry Love Report', price: 49 },
  composite: { title: 'Composite Chart Report', price: 29 },
  couples: { title: 'Couples Cosmic Profile', price: 89 },
  vocation: { title: 'Vocation and Wealth Map', price: 39 },
  karmicshadow: { title: 'Karmic & Shadow Work', price: 19 },
  fullcosmic: { title: 'Full Cosmic Profile', price: 89 },
};
