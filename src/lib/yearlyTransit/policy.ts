import type { AspectType, MovingBody, NatalTarget } from './types';

export const DEFAULT_MOVING_BODIES: readonly MovingBody[] = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
export const DEFAULT_NATAL_TARGETS: readonly NatalTarget[] = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','asc','mc','northnode','chiron'];
export const ACTIVE_ORBS: Readonly<Record<AspectType, number>> = {
  conjunction: 8, opposition: 8, square: 6, trine: 6, sextile: 5,
};

export function validateKnownTimeBirth(input: { date: string; time?: string; unknownTime?: boolean }): void {
  if (input.unknownTime || !input.time || !/^\d{2}:\d{2}(?::\d{2})?$/.test(input.time)) {
    throw new Error('yearly-transit requires a validated known birth time');
  }
}
