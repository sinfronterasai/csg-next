import { aspectError, scanTransitWindows, type TransitEvaluator } from '@/lib/yearlyTransit/engine';

describe('yearly transit deterministic scan/refinement', () => {
  it('uses configured active boundaries and exact-hit strictness', () => {
    expect(aspectError(108, 100, 'conjunction')).toBe(8);
    expect(aspectError(107.999, 100, 'conjunction')).toBeLessThan(8);
    expect(aspectError(108.001, 100, 'conjunction')).toBeGreaterThan(8);
    expect(aspectError(100.099, 100, 'conjunction')).toBeLessThan(0.1);
    expect(aspectError(100.1, 100, 'conjunction')).not.toBeLessThan(0.1);
  });

  it('finds a fast-body exact hit between six-hour samples', async () => {
    const center = Date.parse('2027-01-01T15:00:00.000Z');
    const evaluator: TransitEvaluator = {
      async evaluate(_body, utcMs) {
        return { longitude: 100 + (utcMs - center) / 3_600_000 * 0.05, retrograde: false };
      },
    };
    const windows = await scanTransitWindows({
      fromUtc: '2027-01-01T00:00:00.000Z', toUtc: '2027-01-02T00:00:00.000Z', evaluator,
      natal: [{ key: 'sun', longitude: 100, house: 5 }], movingBodies: ['sun'], natalTargets: ['sun'],
    });
    expect(windows).toHaveLength(1);
    expect(windows[0].activeWindow.startUtc).toBe('2027-01-01T00:00:00.000Z');
    expect(windows[0].activeWindow.endUtc).toBe('2027-01-02T00:00:00.000Z');
    expect(windows[0].exactHits.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(Date.parse(windows[0].exactHits[0].exactUtc) - center)).toBeLessThanOrEqual(60_000);
    expect(windows[0].passIndex).toBe(1);
    expect(windows[0].exactHits[0].id).toMatch(/^sun\.sun\.conjunction\.1\./);
    expect(windows[0].segments).toHaveLength(2);
    expect(windows[0].segments.map((segment) => segment.direction)).toEqual(['applying', 'separating']);
    expect(windows[0].house).toBe(5);
  });

  it('rejects invalid ranges and non-finite ephemeris values', async () => {
    const evaluator: TransitEvaluator = { async evaluate() { return { longitude: Number.NaN, retrograde: false }; } };
    await expect(scanTransitWindows({ fromUtc: '2027-01-02T00:00:00Z', toUtc: '2027-01-01T00:00:00Z', evaluator, natal: [] })).rejects.toThrow(/invalid UTC/);
    await expect(scanTransitWindows({ fromUtc: '2027-01-01T00:00:00Z', toUtc: '2027-01-01T01:00:00Z', evaluator, natal: [{ key: 'sun', longitude: 0, house: null }], movingBodies: ['sun'], natalTargets: ['sun'] })).rejects.toThrow(/non-finite/);
  });
});
