import { geocodeLocation } from '@/lib/chartEngine';

describe('geocodeLocation (real forward geocoder)', () => {
  it('resolves a real city not in the static table (Austin, TX)', async () => {
    const g = await geocodeLocation('Austin, TX');
    expect(g).not.toBeNull();
    expect(g!.lat).toBeCloseTo(30.26, 1);
    expect(g!.lon).toBeCloseTo(-97.74, 1);
  });

  it('returns a usable IANA timezone for the resolved location', async () => {
    const g = await geocodeLocation('Austin, TX');
    expect(typeof g!.timezone).toBe('string');
    expect(g!.timezone.length).toBeGreaterThan(2);
  });

  it('still accepts explicit "lat,lon"', async () => {
    const g = await geocodeLocation('48.8566, 2.3522');
    expect(g!.lat).toBeCloseTo(48.8566, 4);
    expect(g!.lon).toBeCloseTo(2.3522, 4);
  });

  it('returns null for empty input (caller must reject)', async () => {
    const g = await geocodeLocation('');
    expect(g).toBeNull();
  });
});
