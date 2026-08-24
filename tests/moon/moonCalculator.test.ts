import { computeMoonResult } from '@/lib/moonCalculator';
import { SIGNS, getSign } from '@/lib/astrology';

// Deterministic, offline inputs. Paris is in CITY_TABLE so no network needed.
const BIRTH = {
  date: '1990-06-15',
  time: '12:00',
  location: 'Paris, France',
  unknownTime: false,
};

describe('moonCalculator: real engine data', () => {
  it('returns the moon sign computed by Swiss Ephemeris (not a hardcoded list)', async () => {
    const res = await computeMoonResult(BIRTH);
    expect(SIGNS.some((s) => s.key === res.moonSign.key)).toBe(true);
    const ref = getSign(res.moonSign.key);
    expect(ref).toBeDefined();
    expect(res.moonSign.signLabel).toBe(ref!.label);
    expect(res.moonSign.signGlyph).toBe(ref!.glyph);
    expect(res.moonSign.degreeInSign).toBeGreaterThanOrEqual(0);
    expect(res.moonSign.degreeInSign).toBeLessThan(30);
  });

  it('enriches the moon sign with element, modality, traits, and dates', async () => {
    const res = await computeMoonResult(BIRTH);
    const ref = getSign(res.moonSign.key)!;
    expect(res.moonSign.element).toBe(ref.element);
    expect(res.moonSign.modality).toBe(ref.modality);
    expect(res.moonSign.traits).toEqual(ref.traits);
    expect(res.moonSign.dates).toBe(ref.dates);
    expect(res.moonSign.explanation).toBe(ref.explanation);
  });

  it('returns a current moon phase from the engine (0..1 fraction + label)', async () => {
    const res = await computeMoonResult(BIRTH);
    expect(res.moonPhase.phase).toBeGreaterThanOrEqual(0);
    expect(res.moonPhase.phase).toBeLessThanOrEqual(1);
    expect(typeof res.moonPhase.label).toBe('string');
    expect(res.moonPhase.label.length).toBeGreaterThan(0);
  });

  it('is deterministic for identical input', async () => {
    const a = await computeMoonResult(BIRTH);
    const b = await computeMoonResult(BIRTH);
    expect(a.moonSign.key).toBe(b.moonSign.key);
    expect(a.moonSign.degreeInSign).toBe(b.moonSign.degreeInSign);
    expect(a.moonPhase.phase).toBe(b.moonPhase.phase);
  });

  it('geocode failure surfaces as an error (no silent fake sign)', async () => {
    await expect(
      computeMoonResult({ ...BIRTH, location: '' })
    ).rejects.toThrow();
  });
});
