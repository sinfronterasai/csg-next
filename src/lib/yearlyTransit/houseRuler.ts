import { houseForLongitude, normDeg } from '@/lib/chartEngine';
import { signFromLongitude } from '@/lib/astrology';
import type { NatalTarget } from './types';

export const LIFE_AREA_HOUSES = [2, 6, 10] as const;

export interface RulerPlanetAnchor {
  key: string;
  house: number | null;
}

export interface HouseRulerResult {
  targetHouse: number | null;
  targetHouseRuler: string | null;
  rulerNatalHouse: number | null;
  relevant: boolean;
  lifeAreas: string[];
}

function lifeArea(house: number): string | null {
  if (house === 2) return 'money';
  if (house === 6) return 'health/work';
  if (house === 10) return 'career/public-role';
  return null;
}

export function targetHouseRuler(target: NatalTarget, targetHouse: number | null, cusps: readonly number[]): HouseRulerResult {
  if (target === 'asc' || target === 'mc') return { targetHouse, targetHouseRuler: null, rulerNatalHouse: null, relevant: true, lifeAreas: [] };
  if (targetHouse == null || cusps.length < 13) return { targetHouse, targetHouseRuler: null, rulerNatalHouse: null, relevant: false, lifeAreas: [] };
  const cusp = normDeg(cusps[targetHouse]);
  const sign = signFromLongitude(cusp).sign;
  const ruler = sign.ruler.toLowerCase();
  const areas = [lifeArea(targetHouse)].filter((value): value is string => value !== null);
  return { targetHouse, targetHouseRuler: ruler, rulerNatalHouse: null, relevant: areas.length > 0, lifeAreas: areas };
}

export function resolveHouseRulerRelevance(input: {
  target: NatalTarget;
  targetLongitude: number;
  cusps: readonly number[];
  planets: readonly RulerPlanetAnchor[];
}): HouseRulerResult {
  const targetHouse = input.target === 'asc' || input.target === 'mc' ? null : houseForLongitude(input.targetLongitude, [...input.cusps]);
  const base = targetHouseRuler(input.target, targetHouse, input.cusps);
  if (!base.targetHouseRuler) return base;
  const ruler = input.planets.find((planet) => planet.key === base.targetHouseRuler);
  const rulerNatalHouse = ruler?.house ?? null;
  const rulerArea = rulerNatalHouse == null ? null : lifeArea(rulerNatalHouse);
  return { ...base, rulerNatalHouse, relevant: base.relevant || rulerArea !== null, lifeAreas: [...new Set([...base.lifeAreas, ...(rulerArea ? [rulerArea] : [])])] };
}

export function chartRulerForAscendant(ascendantLongitude: number): string {
  return signFromLongitude(ascendantLongitude).sign.ruler.toLowerCase();
}
