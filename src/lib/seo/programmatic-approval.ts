// Per-pair indexability gate for programmatic (token-derived) pages.
//
// Governing rule (John, 2026-08-30 brief reconciliation): grid ROUTES always stay
// LIVE (HTTP 200) with real pair-specific interpretation. The INDEX flag is EARNED
// per page: a page is indexed only once it clears the uniqueness/depth bar. Pages
// that do not yet clear the bar remain live (200) but NOINDEX until curated.
//
// This replaces the earlier fail-closed (404) behavior. The route is never 404.
//
// The allowlist is empty by default => every combo renders live-but-NOINDEX, which
// is the safe default John specified ("if unsure... default that batch to noindex
// and flag me"). When specific pairs are spot-reviewed and approved for indexing,
// add their keys to CSG_INDEXED_PROGRAMMATIC_COMBOS.

export type ProgrammaticKind = "astrology" | "compatibility";

// Comma-separated indexed combo keys, e.g. "astrology:aries-aries,compatibility:aries-libra".
// Empty by default => all programmatic combos are live-but-noindex.
function indexedKeys(): Set<string> {
  const raw = process.env.CSG_INDEXED_PROGRAMMATIC_COMBOS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function programmaticComboKey(
  kind: ProgrammaticKind,
  a: string,
  b: string,
): string {
  const ka = a.toLowerCase();
  const kb = b.toLowerCase();
  if (kind === "compatibility") {
    const [x, y] = ka <= kb ? [ka, kb] : [kb, ka];
    return `compatibility:${x}-${y}`;
  }
  return `astrology:${ka}-${kb}`;
}

/** True only if this exact combo has been spot-reviewed and approved for indexing. */
export function isProgrammaticIndexed(
  kind: ProgrammaticKind,
  a: string,
  b: string,
): boolean {
  return indexedKeys().has(programmaticComboKey(kind, a, b));
}

/** Routes are always live (200). Fail-open counterpart to the old gate. */
export function isProgrammaticLive(): boolean {
  return true;
}
