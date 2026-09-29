jest.mock('@/lib/nextTransit', () => ({
  NEXT_TRANSIT_CONTRACT_VERSION: 'next-major-transit.v1',
  NEXT_TRANSIT_EXPERIMENT_ID: 'GATE25R-next-major-transit-v2-4',
  calculateNextTransit: jest.fn(async () => ({
    nextTransit: {
      mover: 'jupiter',
      moverLabel: 'Jupiter',
      aspect: 'trine',
      target: 'venus',
      targetLabel: 'Venus',
      status: 'UPCOMING',
      activeWindow: { startUtc: '2026-10-01T00:00:00Z', endUtc: '2026-10-10T00:00:00Z' },
      strongestDate: '2026-10-05T00:00:00Z',
      primaryPhase: 'applying',
      shortInterpretation: 'Jupiter supports your natal Venus.',
    },
    significantTransitCount: 3,
    searchPeriod: { fromUtc: '2026-09-28T00:00:00Z', toUtc: '2027-09-28T00:00:00Z', displayTimezone: 'America/Los_Angeles' },
    contractVersion: 'next-major-transit.v1',
  })),
  isNextTransitInputError: jest.fn(() => false),
  isNextTransitCalculationError: jest.fn(() => false),
}));

import { POST } from '@/app/api/transits/next/route';

describe('next-major-transit route', () => {
  it('returns the bounded DTO and next-transit funnel events', async () => {
    const response = await POST(new Request('http://localhost/api/transits/next', {
      method: 'POST',
      body: JSON.stringify({ date: '1980-03-09', time: '16:21', location: 'Santa Cruz, CA' }),
      headers: { 'content-type': 'application/json' },
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result.nextTransit.mover).toBe('jupiter');
    expect(body.result.significantTransitCount).toBe(3);
    expect(body.result).not.toHaveProperty('windows');
    expect(body.events.map((event: { name: string }) => event.name)).toEqual(['next_transit_started', 'next_transit_completed']);
  });
});
