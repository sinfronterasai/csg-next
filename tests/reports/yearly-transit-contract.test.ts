import { mapReportType, PROMPT_SLUG } from '@/lib/reportPipeline';
import { YEARLY_TRANSIT_REPORT_TYPE } from '@/lib/yearlyTransit/types';

describe('yearly-transit n8n contract compatibility', () => {
  it('retains the internal transit alias and discovered yearlytransit slug', () => {
    expect(mapReportType('transit')).toBe(YEARLY_TRANSIT_REPORT_TYPE);
    expect(PROMPT_SLUG.yearlytransit).toBe('08-yearly-transit');
  });
});
