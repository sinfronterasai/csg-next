// Deterministic, seedable scoring + PRNG.
// Mirrors the pattern in @/lib/tarot/draw (FNV-1a seed + mulberry32) so every
// product in csg-next produces identical output for identical inputs. This is a
// cross-cutting product rule: "DETERMINISTIC SCORING" (report-design PART 3 #6) —
// the same user+date+topic always yields the same score, which builds trust.

/** Hash an arbitrary string into a 32-bit unsigned seed (FNV-1a). */
export function makeSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic score in [min, max] from a seed string.
 * Used for: transit topic scoring (<birthDate>:<month>:topic), synastry overall
 * score (<A birthDate>:<B birthDate>:synastry), and the daily personalization line.
 */
export function seededScore(seedStr: string, min = 0, max = 100): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`seededScore: bounds must be finite numbers (got ${min}, ${max})`);
  }
  if (min > max) {
    throw new Error(`seededScore: min (${min}) must not exceed max (${max})`);
  }
  const rng = mulberry32(makeSeed(seedStr));
  // Range formula that supports fractional bounds. For integer bounds the
  // historical inclusive [min, max] behaviour is preserved by integer-rounding.
  const span = max - min;
  const raw = rng() * span;
  return min + (Number.isInteger(min) && Number.isInteger(max) ? Math.floor(raw + 1e-9) : raw);
}

/** Float in [0, 1) — handy for weighted, deterministic choices. */
export function seededUnit(seedStr: string): number {
  return mulberry32(makeSeed(seedStr))();
}
