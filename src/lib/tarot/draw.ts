import { deck, type TarotCard } from "@/lib/tarot/deck";
import { getSpread } from "@/lib/tarot/spreads";

export interface DrawnCard {
  card: TarotCard;
  reversed: boolean;
  positionIndex: number;
  positionLabel: string;
}

/** Hash an arbitrary string into a 32-bit seed (FNV-1a). */
export function makeSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw `count` distinct cards from the deck, deterministically from `seed`. */
export function drawCards(count: number, seed: number): DrawnCard[] {
  const n = Math.max(0, Math.min(count, deck.length));
  const rng = mulberry32(seed);
  const pool = [...deck];
  // Fisher-Yates partial shuffle
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const chosen = pool.slice(0, n);
  return chosen.map((card, i) => ({
    card,
    reversed: rng() < 0.5,
    positionIndex: i,
    positionLabel: "",
  }));
}

/** Draw one card per spread position, aligned to position index/label. */
export function drawForSpread(spreadId: string, seed: number): DrawnCard[] {
  const spread = getSpread(spreadId);
  if (!spread) throw new Error(`Unknown spread: ${spreadId}`);
  const base = drawCards(spread.positions.length, seed);
  return base.map((d, i) => ({
    ...d,
    positionIndex: i,
    positionLabel: spread.positions[i]?.label ?? "",
  }));
}
