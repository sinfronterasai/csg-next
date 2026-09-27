jest.mock('@/lib/namedTransit', () => ({
  calculateNamedTransit: jest.fn(async () => ({
    contractVersion: 'named-transit.v1',
    experimentId: 'R-016-saturn-square-natal-moon',
    status: 'ready',
    transit: { body: 'saturn', label: 'Saturn', aspect: 'square', target: 'moon', targetLabel: 'Natal Moon' },
    birth: { date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', timezone: 'America/Los_Angeles', unknownTime: false },
    calculation: { fromUtc: '2026-01-01T00:00:00.000Z', toUtc: '2026-12-31T00:00:00.000Z', orbDegrees: 1, scanStepHours: 6, ephemeris: 'swiss-ephemeris' },
    windows: [],
    explanation: 'No hit.',
  })),
  isNamedTransitCalculationError: jest.fn(() => false),
  isNamedTransitInputError: jest.fn(() => false),
  NAMED_TRANSIT_CONTRACT_VERSION: 'named-transit.v1',
  NAMED_TRANSIT_EXPERIMENT_ID: 'R-016-saturn-square-natal-moon',
}));

import { POST } from '@/app/api/transits/named/route';

describe('named transit experiment route', () => {
  beforeEach(() => {
    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    delete process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT;
  });

  it('returns the deterministic result for a valid public request', async () => {
    const response = await POST(new Request('http://localhost/api/transits/named', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', fromDate: '2026-01-01' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.assignment).toBe('treatment');
    expect(body.result).toBeDefined();
    expect(body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'named_transit_eligible', contractVersion: 'named-transit.v1' }),
      expect.objectContaining({ name: 'named_transit_assigned', contractVersion: 'named-transit.v1' }),
      expect.objectContaining({ name: 'named_transit_started', contractVersion: 'named-transit.v1' }),
    ]));
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not withhold the public calculation when rollout flags are absent', async () => {
    const response = await POST(new Request('http://localhost/api/transits/named', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', fromDate: '2026-01-01' }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).assignment).toBe('treatment');
  });
});
