const cookieGet = jest.fn();
const verifyToken = jest.fn();
const hasSecureJwtConfiguration = jest.fn();
const query = jest.fn();
const buildNatalNavigator = jest.fn();
const validateNatalNavigatorResponse = jest.fn();

jest.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
jest.mock('@/lib/auth', () => ({
  verifyToken: (...args: unknown[]) => verifyToken(...args),
  hasSecureJwtConfiguration: () => hasSecureJwtConfiguration(),
}));
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => query(...args) }));
jest.mock('@/lib/constellations/natal', () => ({
  buildNatalNavigator: (...args: unknown[]) => buildNatalNavigator(...args),
  validateNatalNavigatorResponse: (...args: unknown[]) => validateNatalNavigatorResponse(...args),
  NavigatorCalculationError: class NavigatorCalculationError extends Error {
    code = 'NAVIGATOR_CALCULATION_FAILED';
  },
}));

import { GET } from '@/app/api/constellations/natal/route';
import { NAVIGATOR_FRAME_BASE, raDecToSceneVector } from '@/lib/constellations/coordinates';
import { getNamedStarsAtEpoch } from '@/lib/constellations/starCatalog';

const row = {
  id: 9, user_id: 7, birth_date: '1980-03-09', birth_time: '16:21', timezone: 'America/Los_Angeles',
  latitude: 36.97, longitude: -122.03, unknown_time: false, natal_positions: { planets: [] },
};
const utc = '1980-03-10T00:21:00.000Z';
const routeBodies = [
  ['sun', 'Sun', '☉'], ['moon', 'Moon', '☽'], ['mercury', 'Mercury', '☿'], ['venus', 'Venus', '♀'],
  ['mars', 'Mars', '♂'], ['jupiter', 'Jupiter', '♃'], ['saturn', 'Saturn', '♄'], ['uranus', 'Uranus', '♅'],
  ['neptune', 'Neptune', '♆'], ['pluto', 'Pluto', '♇'], ['chiron', 'Chiron', '⚷'], ['juno', 'Juno', '⚵'],
  ['northnode', 'True North Node', '☊'],
].map(([key, label, glyph], index) => ({
  key, label, glyph, category: index < 10 ? 'primary' : 'additional', status: 'available',
  rightAscensionDeg: 15, declinationDeg: -12, vector: raDecToSceneVector(15, -12),
  longitude: 31.25, sign: 'taurus', signLabel: 'Taurus', degreeInSign: 1.25, house: 2,
  retrograde: false, source: 'swiss-ephemeris',
}));
const payload = {
  schemaVersion: 'csg-natal-navigator-v1',
  frame: { ...NAVIGATOR_FRAME_BASE, epoch: utc },
  birthAnchor: { utc, timezone: 'America/Los_Angeles', source: 'saved-natal-chart' },
  bodies: routeBodies,
  aspects: [],
  namedStars: getNamedStarsAtEpoch(2444308.5145833334, utc),
  source: { engine: 'swiss-ephemeris', package: '@fusionstrings/swiss-eph', flags: 138850, calculationTime: 'UTC-derived Julian day supplied as tjd_ut' },
  availability: { primary: 'available', optionalUnavailable: [] },
};

describe('GET /api/constellations/natal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookieGet.mockReturnValue({ value: 'token' });
    verifyToken.mockReturnValue({ userId: '7' });
    hasSecureJwtConfiguration.mockReturnValue(true);
    query.mockResolvedValue({ rows: [row] });
    buildNatalNavigator.mockResolvedValue(payload);
    validateNatalNavigatorResponse.mockReturnValue(true);
  });

  it('returns a stable sanitized 401 for missing or invalid authentication', async () => {
    cookieGet.mockReturnValue(undefined);
    let response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to personalize your Cosmic Navigator.' } });
    expect(query).not.toHaveBeenCalled();

    cookieGet.mockReturnValue({ value: 'bad' });
    verifyToken.mockReturnValue(null);
    response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to personalize your Cosmic Navigator.' } });
  });

  it('fails closed before token verification when production JWT configuration is absent', async () => {
    hasSecureJwtConfiguration.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the owned latest-chart query and returns typed 404 when none exists', async () => {
    query.mockResolvedValue({ rows: [] });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'NATAL_CHART_NOT_FOUND', message: 'Create your birth chart to personalize the map.' } });
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/WHERE user_id = \$1[\s\S]*ORDER BY created_at DESC LIMIT 1/), ['7']);
  });

  it('returns typed 409 without invoking Swiss when birth time is unknown', async () => {
    query.mockResolvedValue({ rows: [{ ...row, unknown_time: true, birth_time: null }] });
    const response = await GET();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'BIRTH_TIME_UNKNOWN', message: 'Add an exact birth time to show your natal sky.' } });
    expect(buildNatalNavigator).not.toHaveBeenCalled();
  });

  it('returns the versioned payload without writing to the database', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(buildNatalNavigator).toHaveBeenCalledWith(row);
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toMatch(/^SELECT/i);
  });

  it('returns a stable sanitized 503 for invalid anchors or required calculations', async () => {
    buildNatalNavigator.mockRejectedValue(new Error('Swiss secret/internal path'));
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: { code: 'NAVIGATOR_UNAVAILABLE', message: 'Your natal sky is temporarily unavailable. Please try again.' } });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('maps an invalid internal success payload to sanitized 503', async () => {
    validateNatalNavigatorResponse.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'NAVIGATOR_UNAVAILABLE', message: 'Your natal sky is temporarily unavailable. Please try again.' } });
  });

  it('maps query failures to the same sanitized unavailable response', async () => {
    query.mockRejectedValue(new Error('postgres connection credential detail'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'NAVIGATOR_UNAVAILABLE', message: 'Your natal sky is temporarily unavailable. Please try again.' } });
  });
});
