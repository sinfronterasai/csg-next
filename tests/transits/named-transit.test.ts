import { Constants } from '@fusionstrings/swiss-eph';

const BASE = Date.parse('2026-01-01T00:00:00.000Z');
const SATURN_SE = Constants.SE_SATURN;
let mockModel: 'direct' | 'retrograde' | 'stationary' | 'nonfinite' = 'direct';

function mockSaturn(days: number): { longitude: number; speed: number } {
  if (mockModel === 'nonfinite') return { longitude: 90, speed: Number.NaN };
  if (mockModel === 'stationary') return { longitude: 90.00001 + days * 0.000001, speed: 0.000001 };
  if (mockModel === 'retrograde') {
    if (days <= 1) return { longitude: 89.5 + days * 0.5, speed: 0.5 };
    if (days <= 2) return { longitude: 90 + (days - 1) * 0.8, speed: 0.8 };
    if (days <= 4) return { longitude: 90.8 - (days - 2) * 0.4, speed: -0.4 };
    return { longitude: 90 - (days - 4) * 0.8, speed: -0.8 };
  }
  return { longitude: 89.5 + days * 0.5, speed: 0.5 };
}

jest.mock('@/lib/chartEngine', () => ({
  computeChart: jest.fn(async () => ({
    birth: { location: 'Santa Cruz, CA' },
    moon: { longitude: 0 },
  })),
  geocodeLocation: jest.fn(async () => ({ lat: 36.97412, lon: -122.0308, timezone: 'America/Los_Angeles' })),
  getEph: jest.fn(async () => ({
    swe_calc_ut: (jd: number, body: number) => {
      if (body !== SATURN_SE) return { returnCode: 0, xx: [0, 0, 0, 0] };
      const days = jd - (BASE / 86400000 + 2440587.5);
      const { longitude, speed } = mockSaturn(days);
      return { returnCode: 0, xx: [longitude, 0, 0, speed] };
    },
  })),
  normDeg: (value: number) => ((value % 360) + 360) % 360,
  PLANET_BODIES: [{ key: 'saturn', se: SATURN_SE }],
}));

import { calculateNamedTransit } from '@/lib/namedTransit';

describe('named transit deterministic contract', () => {
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

  beforeEach(() => {
    mockModel = 'direct';
  });

  it('rejects unknown-time requests before calculation', async () => {
    await expect(calculateNamedTransit({ ...request, unknownTime: true })).rejects.toThrow('known birth time');
  });

  it('returns a deterministic refined direct crossing without false stationary classification', async () => {
    const first = await calculateNamedTransit(request);
    const second = await calculateNamedTransit(request);
    expect(first).toEqual(second);
    expect(first.contractVersion).toBe('named-transit.v1');
    expect(first.status).toBe('ready');
    expect(first.windows).toHaveLength(1);
    expect(first.windows[0]).toMatchObject({ direction: 'applying', motion: 'direct', precisionSeconds: 1 });
    expect(first.windows[0].minimumOrbDegrees).toBeLessThanOrEqual(0.00001);
    expect(first.windows[0].startUtc).toBe('2026-01-01T00:00:00Z');
    expect(first.windows[0].exactUtc).toBe('2026-01-02T00:00:00Z');
  });

  it('detects two ordered exact passes inside one continuous active retrograde interval', async () => {
    mockModel = 'retrograde';
    const result = await calculateNamedTransit({ ...request, windowDays: 6 });
    expect(result.windows).toHaveLength(2);
    expect(result.windows.map((window) => window.exactUtc)).toEqual([
      '2026-01-02T00:00:00Z',
      '2026-01-05T00:00:00Z',
    ]);
    expect(result.windows.map((window) => window.motion)).toEqual(['direct', 'retrograde']);
    expect(new Set(result.windows.map((window) => window.id)).size).toBe(2);
    expect(result.windows[0].startUtc).toBe(result.windows[1].startUtc);
    expect(result.windows[0].endUtc).toBe(result.windows[1].endUtc);
  });

  it('classifies genuinely near-stationary motion using the documented speed threshold', async () => {
    mockModel = 'stationary';
    const result = await calculateNamedTransit({ ...request, windowDays: 2 });
    expect(result.windows[0]).toMatchObject({ direction: 'stationary', motion: 'stationary' });
    expect(result.calculation.stationarySpeedDegreesPerDay).toBe(0.01);
  });

  it('fails closed when Saturn motion is non-finite', async () => {
    mockModel = 'nonfinite';
    await expect(calculateNamedTransit(request)).rejects.toThrow('non-finite');
  });

  it('rejects invalid window sizes and coordinates as input errors', async () => {
    await expect(calculateNamedTransit({ ...request, windowDays: 0 })).rejects.toThrow('windowDays');
    await expect(calculateNamedTransit({ ...request, latitude: 91 })).rejects.toThrow('latitude');
    await expect(calculateNamedTransit({ ...request, longitude: 181 })).rejects.toThrow('longitude');
  });

  it.each([
    ['timezone without coordinates', { timezone: request.timezone }],
    ['only latitude', { latitude: request.latitude }],
    ['only longitude', { longitude: request.longitude }],
    ['coordinates without timezone', { latitude: request.latitude, longitude: request.longitude }],
  ])('rejects incomplete location authority: %s', async (_label, partial) => {
    await expect(calculateNamedTransit({ ...request, timezone: undefined, latitude: undefined, longitude: undefined, ...partial })).rejects.toThrow('supplied together');
  });

  it('accepts a complete coordinate/timezone authority bundle', async () => {
    await expect(calculateNamedTransit(request)).resolves.toMatchObject({ birth: { timezone: 'America/Los_Angeles' } });
  });

  it('accepts location-only resolution when no authority fields are supplied', async () => {
    await expect(calculateNamedTransit({ ...request, timezone: undefined, latitude: undefined, longitude: undefined })).resolves.toMatchObject({ birth: { timezone: 'America/Los_Angeles' } });
  });

  it('rejects an invalid IANA timezone', async () => {
    await expect(calculateNamedTransit({ ...request, timezone: 'Mars/Olympus' })).rejects.toThrow('valid IANA timezone');
  });
});
