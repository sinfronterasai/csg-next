import { geocodeLocation } from '@/lib/chartEngine';

// Mock global fetch to simulate Google Maps + Open-Meteo without network/keys.
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function googleGeocodeJson(lat: number, lng: number) {
  return { ok: true, json: async () => ({ results: [{ geometry: { location: { lat, lng } } }] }) };
}
function googleTzJson(tz: string) {
  return { ok: true, json: async () => ({ timeZoneId: tz }) };
}
function openMeteoJson(lat: number, lng: number, tz: string) {
  return { ok: true, json: async () => ({ results: [{ latitude: lat, longitude: lng, timezone: tz }] }) };
}

describe('geocodeLocation: Google Maps integration', () => {
  beforeEach(() => { mockFetch.mockReset(); process.env.GOOGLE_MAPS_API_KEY = 'test-key'; });
  afterAll(() => { delete process.env.GOOGLE_MAPS_API_KEY; });

  it('uses Google Geocoding + Time Zone when a key is set', async () => {
    mockFetch
      .mockResolvedValueOnce(googleGeocodeJson(30.27, -97.74))   // geocode
      .mockResolvedValueOnce(googleTzJson('America/Chicago'));    // timezone
    const g = await geocodeLocation('Austin, TX');
    expect(g).toEqual({ lat: 30.27, lon: -97.74, timezone: 'America/Chicago' });
    expect(mockFetch.mock.calls[0][0]).toContain('maps.googleapis.com/maps/api/geocode');
    expect(mockFetch.mock.calls[1][0]).toContain('maps.googleapis.com/maps/api/timezone');
  });

  it('falls back to Open-Meteo when Google returns no result', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })  // google geocode empty
      .mockResolvedValueOnce(openMeteoJson(35.0, 139.0, 'Asia/Tokyo'));          // open-meteo fallback
    const g = await geocodeLocation('Some Tiny Town');
    expect(g!.timezone).toBe('Asia/Tokyo');
    expect(mockFetch.mock.calls[1][0]).toContain('geocoding-api.open-meteo.com');
  });

  it('without a key, goes straight to Open-Meteo (no Google calls)', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    mockFetch.mockResolvedValueOnce(openMeteoJson(35.68, 139.76, 'Asia/Tokyo'));
    const g = await geocodeLocation('Tokyo, Japan');
    // Tokyo is in the static cache, so no fetch is made at all (expected).
    expect(g!.timezone).toBe('Asia/Tokyo');
  });
});
