import { buildVocationAppendix, buildVocationPeriods, customerCoverageLabel } from '@/lib/vocationPresentation';
import { hasUnsafeVocationProse, sanitizeVocationProse, validateVocationSnapshot } from '@/lib/vocationIntegrity';

describe('vocation customer contract', () => {
  const pack = {
    generatedLocalDate: '2026-09-23', displayTimezone: 'America/Los_Angeles',
    period: { fromUtc: '2026-09-23T07:00:00.000Z', toUtc: '2028-09-01T07:00:00.000Z' },
    months: Array.from({ length: 24 }, () => ({ key: 'x', windowIds: [] })),
    windows: [
      { id: 'a', localStart: '2026-09-23', localEnd: '2026-10-20', mover: 'saturn', target: 'mc', aspect: 'square', direction: 'applying', exactHits: [], activeWindow: { startUtc: '2026-09-23T07:00:00.000Z', endUtc: '2026-10-20T07:00:00.000Z' } },
      { id: 'b', localStart: '2027-01-01', localEnd: '2027-02-01', mover: 'jupiter', target: 'jupiter', aspect: 'trine', direction: 'separating', exactHits: [], activeWindow: { startUtc: '2027-01-01T08:00:00.000Z', endUtc: '2027-02-01T08:00:00.000Z' } },
    ],
    birthSnapshot: { date: '1980-03-09', time: '16:21', location: 'Santa Cruz, California', timezone: 'America/Los_Angeles', latitude: 36.97412, longitude: -122.0308 },
  };
  const ledger = { reportData: { vocationEvidence: { careerWindowPack: pack } } };
  test('rejects a saved birth snapshot that contradicts the ledger', () => {
    expect(validateVocationSnapshot({ dob: '1980-03-09', birthTime: '16:21', place: 'Santa Cruz, California', tz: 'Europe/Paris' }, ledger).ok).toBe(false);
  });
  test('uses an exclusive UTC end and a customer-facing local coverage label', () => {
    expect(validateVocationSnapshot({ dob: '1980-03-09', birthTime: '16:21', place: 'Santa Cruz, California', tz: 'America/Los_Angeles' }, ledger).ok).toBe(true);
    expect(customerCoverageLabel(pack)).toContain('August 31, 2028');
  });
  test('groups periods chronologically and humanizes the appendix', () => {
    expect(buildVocationPeriods(pack.windows).length).toBe(2);
    expect(buildVocationAppendix(pack.windows)[0].transit).toContain('Saturn square');
  });
  test('removes internal ids while preserving the customer sentence and rejects certainty', () => {
    expect(sanitizeVocationProse('The pattern (common.ruler.10) supports your work.')).toBe('The pattern supports your work.');
    expect(hasUnsafeVocationProse([{ prose: 'You will become wealthy.' }])).toHaveLength(1);
  });
});
