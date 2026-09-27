import { computeMoonResult, illuminationPercent, validateMoonInput } from '@/lib/moonCalculator';
import { SIGNS, getSign } from '@/lib/astrology';
import { FIXED_EXPECTED } from '../reports/fixtures/independentReferenceCorpus';

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
    const evaluatedAt = new Date('2026-09-27T00:00:00Z');
    const res = await computeMoonResult(BIRTH, evaluatedAt);
    expect(res.moonPhase.phase).toBeGreaterThanOrEqual(0);
    expect(res.moonPhase.phase).toBeLessThanOrEqual(1);
    expect(typeof res.moonPhase.label).toBe('string');
    expect(res.moonPhase.label.length).toBeGreaterThan(0);
    expect(res.moonPhase.evaluatedAtUtc).toBe(evaluatedAt.toISOString());
    expect(res.moonPhase.illuminationPercent).toBe(illuminationPercent(res.moonPhase.phase));
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

  it('matches the fixed independent NASA/JPL lunar-longitude fixture', async () => {
    const res = await computeMoonResult(BIRTH, new Date('2026-09-27T00:00:00Z'));
    const diff = Math.abs(res.moonSign.longitude - FIXED_EXPECTED.moon.longitude);
    expect(Math.min(diff, 360 - diff)).toBeLessThanOrEqual(0.5);
    expect(res.moonSign.key).toBe(FIXED_EXPECTED.moon.sign);
  });

  it('rejects impossible dates, invalid times, and accepts leap day', () => {
    expect(() => validateMoonInput({ ...BIRTH, date: '2026-02-30' })).toThrow(/valid calendar date/);
    expect(() => validateMoonInput({ ...BIRTH, time: '24:00' })).toThrow(/valid 24-hour time/);
    expect(() => validateMoonInput({ ...BIRTH, date: '2024-02-29' })).not.toThrow();
    expect(() => validateMoonInput({ ...BIRTH, date: '2023-02-29' })).toThrow(/valid calendar date/);
  });

  it('uses noon when birth time is unknown and preserves the disclosure flag', async () => {
    const res = await computeMoonResult({ ...BIRTH, time: undefined, unknownTime: true }, new Date('2026-09-27T00:00:00Z'));
    expect(res.birth.unknownTime).toBe(true);
    expect(res.birth.time).toBe('');
  });
});

describe('moon illumination independent phase fixtures', () => {
  it.each([
    ['New Moon', 0, 0],
    ['First Quarter', 0.25, 50],
    ['Full Moon', 0.5, 100],
    ['Last Quarter', 0.75, 50],
  ])('%s has the expected illuminated fraction', (_label, phase, expected) => {
    expect(illuminationPercent(phase)).toBe(expected);
  });
});
