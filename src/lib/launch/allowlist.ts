// Server-authoritative launch allowlist (L3).
//
// Two constants of truth, both sourced from server config (env) — NEVER from
// client input:
//   - LAUNCH types: which report types are available to buy/generate at launch.
//   - Love Blueprint beta allowlist: which stable internal user IDs may buy the
//     private-beta paid type. EMPTY by default (no env configured = nobody).
//
// UI hiding is intentionally not relied upon: the gate lives in the server
// request path (checkout + generation routes). A client-supplied `tier` is
// never consulted, so it cannot downgrade or unlock a product.

import type { ReportType } from '@/lib/reportEngine';

/** Report types available to generate at launch (free + paid). */
export const LAUNCH_FREE_TYPES: ReadonlyArray<ReportType> = ['natal'];
export const LAUNCH_PAID_TYPES: ReadonlyArray<ReportType> = ['loveblueprint'];

const LAUNCH_TYPES: ReadonlySet<string> = new Set<string>([
  ...LAUNCH_FREE_TYPES,
  ...LAUNCH_PAID_TYPES,
]);

/** A report type is launch-available (generatable / purchasable) iff it is in the set. */
export function isLaunchType(type: string): boolean {
  return LAUNCH_TYPES.has(type);
}

// --- Love Blueprint private-beta allowlist -------------------------------------

const BETA_ENV_VAR = 'LOVEBLUEPRINT_BETA_USER_IDS';

/**
 * Stable internal user IDs permitted to buy Love Blueprint during private beta.
 * EMPTY by default. Configured only via server env as a comma-separated list.
 * Read fresh on every call so tests (and runtime config reloads) can toggle it.
 */
export function getLoveBlueprintBetaUserIds(): ReadonlySet<string> {
  const raw = process.env[BETA_ENV_VAR];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

/** Keyed by stable internal user ID, never email or client-supplied input. */
export function isLoveBlueprintBetaUser(userId: string | number): boolean {
  return getLoveBlueprintBetaUserIds().has(String(userId));
}

export type LaunchGateCode = 'launch_unavailable' | 'beta_not_allowlisted';

export interface LaunchGateResult {
  allowed: boolean;
  code?: LaunchGateCode;
}

/**
 * Gate for the CHECKOUT route. Rejects non-launch types and, for the beta paid
 * type, non-allowlisted users. Never consults any client-supplied `tier`.
 */
export function gateCheckout(type: string, userId: string | number): LaunchGateResult {
  if (!isLaunchType(type)) {
    return { allowed: false, code: 'launch_unavailable' };
  }
  if (type === 'loveblueprint' && !isLoveBlueprintBetaUser(userId)) {
    return { allowed: false, code: 'beta_not_allowlisted' };
  }
  return { allowed: true };
}

/**
 * Gate for the GENERATION route. Re-check the beta allowlist here rather than
 * trusting checkout history: an old/pre-existing paid purchase must not bypass
 * the current controlled-beta membership.
 */
export function gateGeneration(type: string, userId: string | number): LaunchGateResult {
  if (!isLaunchType(type)) {
    return { allowed: false, code: 'launch_unavailable' };
  }
  if (type === 'loveblueprint' && !isLoveBlueprintBetaUser(userId)) {
    return { allowed: false, code: 'beta_not_allowlisted' };
  }
  return { allowed: true };
}
