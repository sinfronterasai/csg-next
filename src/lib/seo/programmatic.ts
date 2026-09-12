// Deterministic content derivation for programmatic families from real SIGNS data.
// No LLM, no scraping: every fact comes from src/lib/astrology SIGNS/RULERS/OPPOSITE.
import { SIGNS, getSign, type SignInfo, type SignKey } from "@/lib/astrology";

const SIGN_KEYS: SignKey[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

export function allSignKeys(): SignKey[] {
  return SIGN_KEYS;
}

export function signLabel(key: string): string {
  const s = getSign(key);
  return s ? s.label : key.charAt(0).toUpperCase() + key.slice(1);
}

// Canonical pair ordering: a <= b alphabetically.
export function canonicalPair(a: string, b: string): [string, string] {
  const ka = a.toLowerCase();
  const kb = b.toLowerCase();
  return ka <= kb ? [ka, kb] : [kb, ka];
}

export interface ZodiacPageData {
  sign: SignInfo;
  elementPeers: SignInfo[];
  compatible: SignInfo[];
  opposite: SignInfo | null;
}

export function zodiacData(key: string): ZodiacPageData | null {
  const sign = getSign(key);
  if (!sign) return null;
  const elementPeers = SIGNS.filter((s) => {
    if (s.element !== sign.element) return false;
    return s.key !== sign.key;
  });
  const compatible = (sign.love || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((label) => SIGNS.find((s) => s.label.toLowerCase() === label.toLowerCase()))
    .filter((s): s is SignInfo => !!s);
  const opposite = SIGNS.find((s) => s.key === OPP_MAP[sign.key]) || null;
  return { sign, elementPeers, compatible, opposite };
}

const OPP_MAP: Record<string, string> = {
  aries: "libra", libra: "aries",
  taurus: "scorpio", scorpio: "taurus",
  gemini: "sagittarius", sagittarius: "gemini",
  cancer: "capricorn", capricorn: "cancer",
  leo: "aquarius", aquarius: "leo",
  virgo: "pisces", pisces: "virgo",
};

// Evidence table rows for a sign page (deterministic facts).
export function signEvidenceRows(sign: SignInfo): Array<[string, string]> {
  return [
    ["Element", sign.element],
    ["Modality", sign.modality],
    ["Ruler", sign.ruler],
    ["Dates", sign.dates],
    ["Numerology", sign.number],
    ["Core power", sign.power],
  ];
}

export interface CompatibilityPageData {
  a: SignInfo;
  b: SignInfo;
  canonical: string;
  elementMix: string;
  modalityMix: string;
  sharedElement: boolean;
  sharedModality: boolean;
}

export function compatibilityData(aRaw: string, bRaw: string): CompatibilityPageData | null {
  const a = getSign(aRaw);
  const b = getSign(bRaw);
  if (!a || !b) return null;
  const [ca, cb] = canonicalPair(a.key, b.key);
  const sharedElement = a.element === b.element;
  const sharedModality = a.modality === b.modality;
  const elementMix = a.element + " + " + b.element;
  const modalityMix = a.modality + " + " + b.modality;
  return {
    a, b,
    canonical: "/compatibility/" + ca + "-and-" + cb,
    elementMix, modalityMix, sharedElement, sharedModality,
  };
}

export interface AstrologyPageData {
  sun: SignInfo;
  moon: SignInfo;
  sunElement: string;
  moonElement: string;
  sunModality: string;
  moonModality: string;
}

export function astrologyData(sunRaw: string, moonRaw: string): AstrologyPageData | null {
  const sun = getSign(sunRaw);
  const moon = getSign(moonRaw);
  if (!sun || !moon) return null;
  return {
    sun, moon,
    sunElement: sun.element,
    moonElement: moon.element,
    sunModality: sun.modality,
    moonModality: moon.modality,
  };
}
