import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';

it('builds corrected facts with forced Pacific timezone and coordinates through the real engine', async () => {
  const built = await buildVerifiedFactsForReport('loveblueprint', {
    name: 'Fixture A', date: '1990-06-15', time: '12:00', location: 'Santa Cruz Ca',
    timezone: 'America/Los_Angeles', latitude: 36.97412, longitude: -122.0308,
  }, '2026-09-09');
  expect(built.ok).toBe(true);
  if (!built.ok) return;
  expect(built.ledger.schemaVersion).toBe('csg-report-facts-v2');
  expect(built.ledger.reportType).toBe('loveblueprint');
  expect(built.ledger.asOfDate).toBe('2026-09-09');
  expect(built.ledger.common.positions.length).toBeGreaterThan(10);
  expect(built.ledger.facts['natal.sun.position'].source).toBe('swiss-ephemeris');
});
