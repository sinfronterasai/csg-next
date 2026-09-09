import { POST } from '@/app/api/reports/generate/route';
import { preflightReport } from '@/lib/reportFacts/schemas';
import { writeFileSync } from 'fs';

// Only persistence, authentication and outbound dispatch are mocked. The entire
// chart -> VerifiedFacts -> preflight path uses the installed WASM and real data.
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ get: () => ({ value: 'tok' }) }) }));
jest.mock('@/lib/auth', () => ({ verifyToken: () => ({ userId: '7' }), getUserById: async () => ({ id: 7, first_name: 'Fixture', email: 'offline@example.invalid', role: 'customer' }) }));
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/reportPipeline', () => ({
  mapReportType: (type: string) => type,
  isUnsupportedForPipeline: () => false,
  dispatchReport: jest.fn(async () => ({ ok: true, status: 200 })),
}));

const provisioned = process.env.SWISS_EPHEMERIS_DIR ? describe : describe.skip;
provisioned('Free Natal route with a real complete ledger', () => {
  it('persists and dispatches the computed Santa Cruz facts without a paid API or database', async () => {
    const network = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network forbidden'));
    const query = require('@/lib/db').query as jest.Mock;
    let stored: any;
    query.mockImplementation(async (sql: string, args: any[]) => {
      if (sql.includes('FROM natal_charts')) return { rows: [{ birth_date: new Date('1980-03-09'), birth_time: '16:21:00', location_name: 'Santa Cruz, CA', latitude: 36.97412, longitude: -122.0308, timezone: 'America/Los_Angeles', unknown_time: false }] };
      if (sql.startsWith('INSERT INTO readings')) {
        stored = JSON.parse(args[4]);
        return { rows: [{ id: 123, result: args[4] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    try {
      const response = await POST(new Request('http://localhost/api/reports/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'natal' }) }));
      expect(response.status).toBe(200);
      const dispatch = require('@/lib/reportPipeline').dispatchReport as jest.Mock;
      expect(dispatch).toHaveBeenCalledTimes(1);
      const payload = dispatch.mock.calls[0][0];
      expect(preflightReport('natal', payload.verifiedFacts).status).toBe('complete');
      expect(payload.birthData).toMatchObject({ dob: '1980-03-09', birthTime: '16:21:00', tz: 'America/Los_Angeles' });
      expect(stored.metadata.verifiedFacts).toEqual(payload.verifiedFacts);
      expect(payload.verifiedFacts.facts['natal.chiron.position'].value.longitude).toBeGreaterThan(40);
      expect(payload.verifiedFacts.facts['natal.juno.position'].value.longitude).toBeGreaterThan(107);
      expect(network).not.toHaveBeenCalled();
      if (process.env.EPHEMERIS_EVIDENCE_PATH) writeFileSync(process.env.EPHEMERIS_EVIDENCE_PATH, JSON.stringify({ birth: payload.birthData, preflight: preflightReport('natal', payload.verifiedFacts), ledger: payload.verifiedFacts }, null, 2) + '\n');
    } finally { network.mockRestore(); }
  });
});
