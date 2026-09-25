import { Constants } from '@fusionstrings/swiss-eph';

const BASE = Date.parse('2026-01-01T00:00:00.000Z');
const SATURN_SE = Constants.SE_SATURN;

jest.mock('@/lib/chartEngine', () => ({
  computeChart: jest.fn(async () => ({
    birth: { location: 'Santa Cruz, CA' },
    moon: { longitude: 0 },
  })),
  geocodeCoordinates: jest.fn((lat: number, lon: number) => ({ lat, lon, timezone: 'America/Los_Angeles' })),
  geocodeLocation: jest.fn(async () => ({ lat: 36.97412, lon: -122.0308, timezone: 'America/Los_Angeles' })),
  getEph: jest.fn(async () => ({
    swe_calc_ut: (jd: number, body: number) => {
      if (body !== SATURN_SE) return { returnCode: 0, xx: [0, 0, 0, 0] };
      const days = (jd - (BASE / 86400000 + 2440587.5));
      return { returnCode: 0, xx: [89.5 + days * 0.5, 0, 0, 0.5] };
    },
  })),
  normDeg: (value: number) => ((value % 360) + 360) % 360,
  PLANET_BODIES: [{ key: 'saturn', se: SATURN_SE }],
}));

import { calculateNamedTransit } from '@/lib/namedTransit';

describe('named transit contract', () => {
  const request = {
    date: '1980-03-09',
    time: '16:21',
    location: 'Santa Cruz, CA',
    timezone: 'America/Los_Angeles',
    latitude: 36.97412,
    longitude: -122.0308,
    fromDate: '2026-01-01',
    windowDays: 10,
  };

  it('rejects unknown-time requests before calculation', async () => {
    await expect(calculateNamedTransit({ ...request, unknownTime: true })).rejects.toThrow('named transit windows require a known birth time');
  });

  it('returns a deterministic refined window with a versioned contract', async () => {
    const first = await calculateNamedTransit(request);
    const second = await calculateNamedTransit(request);
    expect(first).toEqual(second);
    expect(first.contractVersion).toBe('named-transit.v1');
    expect(first.status).toBe('ready');
    expect(first.windows).toHaveLength(1);
    expect(first.windows[0]).toMatchObject({ direction: 'stationary', precisionSeconds: 1 });
    expect(first.windows[0].minimumOrbDegrees).toBeLessThanOrEqual(0.00001);
    expect(first.windows[0].startUtc).toBe('2026-01-01T00:00:00Z');
    expect(first.windows[0].exactUtc).toBe('2026-01-02T00:00:00Z');
  });

  it('rejects invalid window sizes as input errors', async () => {
    await expect(calculateNamedTransit({ ...request, windowDays: 0 })).rejects.toThrow('windowDays');
  });

  it('rejects coordinates outside the geographic contract before calculation', async () => {
    await expect(calculateNamedTransit({ ...request, latitude: 91 })).rejects.toThrow('latitude');
    await expect(calculateNamedTransit({ ...request, longitude: 181 })).rejects.toThrow('longitude');
  });
});
