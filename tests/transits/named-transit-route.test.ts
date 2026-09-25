jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn(() => undefined),
  })),
}));
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
    process.env.CSG_NAMED_TRANSIT_EXPERIMENT = 'true';
  });

  afterEach(() => {
    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
  });

  it('assigns a persistent arm and emits versioned events', async () => {
    const response = await POST(new Request('http://localhost/api/transits/named', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA', fromDate: '2026-01-01' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(['control', 'treatment']).toContain(body.assignment);
    expect(body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'named_transit_eligible', contractVersion: 'named-transit.v1' }),
      expect.objectContaining({ name: 'named_transit_assigned', contractVersion: 'named-transit.v1' }),
      expect.objectContaining({ name: 'named_transit_started', contractVersion: 'named-transit.v1' }),
    ]));
    expect(response.headers.get('set-cookie')).toContain('csg_named_transit_assignment=');
  });

  it('fails closed when the feature flag is disabled', async () => {
    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    const response = await POST(new Request('http://localhost/api/transits/named', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(404);
  });
});
