import { REPORT_META } from '@/lib/reportEngine';
import { reportSku } from '@/lib/billing/reportPurchase';

describe('yearly transit billing contract', () => {
  it('uses exactly $49 for the transit product and its stable SKU', () => {
    expect(REPORT_META.transit.price).toBe(49);
    expect(reportSku('transit')).toBe('report-transit');
    expect(Math.round(REPORT_META.transit.price * 100)).toBe(4900);
  });
});
