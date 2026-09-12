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

// Compute the natal moon sign + current moon phase for a birth.
// Throws if the location cannot be geocoded (no silent fallback to a fake sign).
export async function computeMoonResult(input: MoonInput): Promise<MoonCalculatorResult> {
  const { date, time, location, unknownTime } = input;
  if (!date || !location) {
    throw new Error('date and location are required');
  }

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
  const now = new Date();
  const phase = await moonPhase(dateToJulianDay(now));

  return {
    birth: {
      date,
      time: unknownTime ? '' : (time || ''),
      location,
      unknownTime: Boolean(unknownTime),
    },
    moonSign,
    moonPhase: { phase: phase.phase, label: phase.label },
  };
}
