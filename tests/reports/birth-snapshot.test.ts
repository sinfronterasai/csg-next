import { POST as save } from '@/app/api/birth-chart/route';
import { POST as generate } from '@/app/api/reports/generate/route';
import { query } from '@/lib/db';
import { buildVerifiedFactsForReport } from '@/lib/reportFacts/integrate';
import { consumeReportPurchase } from '@/lib/billing/reportPurchaseStore';
import { dispatchReport } from '@/lib/reportPipeline';

jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test' }) }) }));
jest.mock('@/lib/auth', () => ({ verifyToken: () => ({ userId: '7' }), getUserById: async () => ({ id: 7, first_name: 'Fixture', role: 'customer' }) }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/reportFacts/integrate', () => ({ ...jest.requireActual('@/lib/reportFacts/integrate'), buildVerifiedFactsForReport: jest.fn(async () => ({ ok: true, ledger: { fixture: true } })) }));
jest.mock('@/lib/billing/reportPurchase', () => ({ verifyPurchasePaidViaStripe: jest.fn() }));
jest.mock('@/lib/billing/reportPurchaseStore', () => ({ getReportPurchase: async () => ({ userId: 7, reportType: 'natalpremium', sku: 'report-natalpremium', status: 'paid' }), isValidPurchaseId: () => true, consumeReportPurchase: jest.fn() }));
jest.mock('@/lib/reportPipeline', () => ({ ...jest.requireActual('@/lib/reportPipeline'), dispatchReport: jest.fn(async () => ({ ok: true })) }));

const birth = { date: '1980-03-09', time: '16:21', location: '36.97412,-122.0308', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles' };
let stored: any;
function request(body: any) { return new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) }); }
beforeEach(() => {
  jest.clearAllMocks();
  process.env.LOVEBLUEPRINT_BETA_USER_IDS = '7';
  stored = { id: 1, birth_date: birth.date, birth_time: birth.time, location_name: birth.location, latitude: birth.latitude, longitude: birth.longitude, timezone: birth.timezone, unknown_time: false };
  (query as jest.Mock).mockImplementation(async (sql: string, p: any[]) => {
    if (sql.includes('INSERT INTO natal_charts')) { stored = { ...stored, timezone: p[3] }; return { rows: [{ id: 1 }] }; }
    if (sql.includes('FROM natal_charts')) return { rows: [stored] };
    return { rows: [] };
  });
  (consumeReportPurchase as jest.Mock).mockImplementation(async ({ reading }) => ({ outcome: 'consumed', readingId: 1, readingResult: JSON.parse(reading.resultJson) }));
});
it('saves and dispatches the same Pacific coordinates/timezone used to build immutable facts', async () => {
  expect((await save(request(birth))).status).toBe(200);
  expect(stored.timezone).toBe(birth.timezone);
  expect((await generate(request({ type: 'natalpremium', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }))).status).toBe(200);
  expect(buildVerifiedFactsForReport).toHaveBeenCalledWith('natal', expect.objectContaining({ timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }));
  const payload = (dispatchReport as jest.Mock).mock.calls[0][0];
  expect(payload.birthData).toMatchObject({ dob: birth.date, birthTime: birth.time, tz: birth.timezone, lat: birth.latitude, lon: birth.longitude });
  expect(payload.verifiedFacts).toEqual(JSON.parse((consumeReportPurchase as jest.Mock).mock.calls[0][0].reading.resultJson).metadata.verifiedFacts);
});
it('recomputes legacy UTC input without relabeling or updating the old stored chart', async () => {
  stored.timezone = 'UTC';
  expect((await generate(request({ type: 'natalpremium', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }))).status).toBe(200);
  expect(buildVerifiedFactsForReport).toHaveBeenCalledWith('natal', expect.objectContaining({ timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }));
  expect((query as jest.Mock).mock.calls.some(([sql]) => sql.includes('UPDATE natal_charts'))).toBe(false);
});
it('uses recovered coordinates in both immutable facts and dispatch when old coordinates are absent', async () => {
  stored.latitude = null; stored.longitude = null; stored.timezone = 'UTC'; stored.location_name = 'Santa Cruz, CA';
  expect((await generate(request({ type: 'natalpremium', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }))).status).toBe(200);
  expect((dispatchReport as jest.Mock).mock.calls[0][0].birthData).toMatchObject({ lat: birth.latitude, lon: birth.longitude, tz: birth.timezone });
});
it('does not consume a paid purchase or dispatch when the real ephemeris preflight is incomplete', async () => {
  (buildVerifiedFactsForReport as jest.Mock).mockImplementationOnce(jest.requireActual('@/lib/reportFacts/integrate').buildVerifiedFactsForReport);
  const response = await generate(request({ type: 'natalpremium', purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ mode: 'preflight_failed', missing: expect.arrayContaining(['natal.chiron.position: ephemeris unavailable', 'natal.juno.position: ephemeris unavailable']) });
  expect(consumeReportPurchase).not.toHaveBeenCalled();
  expect(dispatchReport).not.toHaveBeenCalled();
});
it.each([null, '', 91])('rejects invalid explicit latitude %p before persistence', async latitude => {
  expect((await save(request({ ...birth, latitude }))).status).toBe(400);
  expect(query).not.toHaveBeenCalled();
});
it('uses the supplied coordinates rather than an unrelated named-city timezone', async () => {
  expect((await save(request({ ...birth, location: 'Paris, France', timezone: 'UTC' }))).status).toBe(200);
  expect(stored.timezone).toBe(birth.timezone);
});
