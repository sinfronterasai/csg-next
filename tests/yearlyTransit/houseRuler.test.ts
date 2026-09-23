import { chartRulerForAscendant, resolveHouseRulerRelevance, targetHouseRuler } from '@/lib/yearlyTransit/houseRuler';

describe('yearly transit house-ruler policy', () => {
  const cusps = [0, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  it('marks targets in houses 2, 6, and 10 relevant', () => {
    for (const [targetLongitude, house] of [[10, 1], [40, 2], [160, 6], [280, 10]] as const) {
      const result = resolveHouseRulerRelevance({ target: 'venus', targetLongitude, cusps, planets: [] });
      expect(result.targetHouse).toBe(house);
      expect(result.relevant).toBe(house === 2 || house === 6 || house === 10);
    }
  });

  it('marks a target relevant when its cusp ruler is placed in a life-area house', () => {
    const result = resolveHouseRulerRelevance({ target: 'mars', targetLongitude: 100, cusps, planets: [{ key: 'sun', house: 6 }, { key: 'moon', house: 6 }, { key: 'mars', house: 4 }] });
    // House 4 begins at Cancer, whose ruler is the Moon; Moon is in house 6.
    expect(result.targetHouse).toBe(4);
    expect(result.targetHouseRuler).toBe('moon');
    expect(result.rulerNatalHouse).toBe(6);
    expect(result.relevant).toBe(true);
  });

  it('uses only the cusp ruler, so intercepted signs add no additional ruler', () => {
    const interceptedCusps = [0, 0, 10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310];
    const result = targetHouseRuler('jupiter', 1, interceptedCusps);
    expect(result.targetHouseRuler).toBe('mars');
    expect(result.relevant).toBe(false);
  });

  it('always treats ASC and MC as relevant and resolves the chart ruler from the ASC sign', () => {
    expect(resolveHouseRulerRelevance({ target: 'asc', targetLongitude: 1, cusps, planets: [] }).relevant).toBe(true);
    expect(resolveHouseRulerRelevance({ target: 'mc', targetLongitude: 271, cusps, planets: [] }).relevant).toBe(true);
    expect(chartRulerForAscendant(0)).toBe('mars');
    expect(chartRulerForAscendant(30)).toBe('venus');
  });
});
