// Fail-closed approval registry for programmatic (token-derived) pages.
//
// Per the governing editorial queue (C / programmatic-family decisions), the
// 144 Sun/Moon combos and 66+ compatibility pairs are HOLD/REFRESH AS A CLASS:
// each needs editorially approved pair-specific content before it can be
// publicly indexed or even rendered as real prose. Until an approved CMS record
// exists for a given combo, the route MUST be unavailable to public users
// (renders 404 / noindex), not merely "noindex with visible template text".
//
// This module is the single gate. Today the allowlist is empty (no combo has
// been approved), so every combo is unavailable. When approved content lands,
// add the combo key to the allowlist (driven by an env var or CMS lookup) and
// only then does the page render. Route scaffolding and the SIGNS data model
// remain; only unapproved prose is hidden.

export type ProgrammaticKind = "astrology" | "compatibility";

// Comma-separated approved combo keys, e.g. "astrology:aries-aries,compatibility:aries-libra".
// Empty by default => all programmatic combos are held (fail-closed).
function approvedKeys(): Set<string> {
  const raw = process.env.CSG_APPROVED_PROGRAMMATIC_COMBOS;
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

/** True only if this exact combo has an approved-content record. Fail-closed. */
export function isProgrammaticApproved(
  kind: ProgrammaticKind,
  a: string,
  b: string,
): boolean {
  return approvedKeys().has(programmaticComboKey(kind, a, b));
}
