// Single source of truth for the /moon-calculator feature.
// Pulls the user's natal moon sign from the real Swiss Ephemeris chart engine
// (computeChart -> ChartData.moon) and the current moon phase from transit.ts,
// then enriches the sign with reference data from astrology.ts.
//
// This module is server-only: chartEngine.ts and transit.ts load the WASM
// ephemeris via fs, so it must never be imported into a client component.
// The page talks to it through /api/moon-calculator.

import { computeChart } from './chartEngine';
import { moonPhase, dateToJulianDay } from './transit';
import { getSign, type SignKey } from './astrology';

export interface MoonSignResult {
  key: SignKey;
  signLabel: string;
  signGlyph: string;
  degreeInSign: number;
  longitude: number;
  element: string;
  modality: string;
  traits: string[];
  dates: string;
  explanation: string;
}

export interface MoonPhaseResult {
  phase: number; // 0..1 (0=new, 0.5=full)
  label: string;
  illuminationPercent: number;
  evaluatedAtUtc: string;
}

export interface MoonCalculatorResult {
  birth: { date: string; time: string; location: string; unknownTime: boolean };
  moonSign: MoonSignResult;
  moonPhase: MoonPhaseResult;
}

export interface MoonInput {
  date: string;
  time?: string;
  location: string;
  unknownTime?: boolean;
}

export class MoonInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoonInputValidationError';
  }
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function validateMoonInput(input: MoonInput): void {
  if (!input || typeof input.date !== 'string' || !isValidCalendarDate(input.date)) {
    throw new MoonInputValidationError('date must be a valid calendar date in YYYY-MM-DD format');
  }
  if (input.unknownTime !== undefined && typeof input.unknownTime !== 'boolean') {
    throw new MoonInputValidationError('unknownTime must be a boolean');
  }
  if (typeof input.location !== 'string' || !input.location.trim()) {
    throw new MoonInputValidationError('date and location are required');
  }
  if (!input.unknownTime && (typeof input.time !== 'string' || !isValidTime(input.time))) {
    throw new MoonInputValidationError('time must be a valid 24-hour time in HH:mm format');
  }
  if (input.unknownTime && input.time !== undefined && (typeof input.time !== 'string' || !isValidTime(input.time))) {
    throw new MoonInputValidationError('time must be a valid 24-hour time in HH:mm format');
  }
}

export function illuminationPercent(phase: number): number {
  const normalized = Math.min(1, Math.max(0, phase));
  return Math.round((1 - Math.cos(2 * Math.PI * normalized)) * 50);
}

// Compute the natal moon sign + current moon phase for a birth.
// Throws if the location cannot be geocoded (no silent fallback to a fake sign).
export async function computeMoonResult(input: MoonInput, now = new Date()): Promise<MoonCalculatorResult> {
  validateMoonInput(input);
  const { date, time, location, unknownTime } = input;

  // Natal moon sign from the real engine (Swiss Ephemeris).
  const chart = await computeChart({
    date,
    time: time || '12:00',
    location,
    unknownTime: Boolean(unknownTime),
  });
  const moon = chart.moon;
  const info = getSign(moon.sign);
  if (!info) throw new Error(`unknown moon sign key: ${moon.sign}`);

  const moonSign: MoonSignResult = {
    key: moon.sign,
    signLabel: moon.signLabel,
    signGlyph: moon.signGlyph,
    degreeInSign: moon.degreeInSign,
    longitude: moon.longitude,
    element: info.element,
    modality: info.modality,
    traits: info.traits,
    dates: info.dates,
    explanation: info.explanation,
  };

  // Current moon phase from the engine (Sun-Moon elongation).
  const phase = await moonPhase(dateToJulianDay(now));

  return {
    birth: {
      date,
      time: unknownTime ? '' : (time || ''),
      location,
      unknownTime: Boolean(unknownTime),
    },
    moonSign,
    moonPhase: {
      phase: phase.phase,
      label: phase.label,
      illuminationPercent: illuminationPercent(phase.phase),
      evaluatedAtUtc: now.toISOString(),
    },
  };
}
