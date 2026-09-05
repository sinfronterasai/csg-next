// Server-authoritative launch allowlist (L3).
//
// Two constants of truth, both sourced from server config (env) — NEVER from
// client input:
//   - LAUNCH types: which report types are available to buy/generate at launch.
//
// NOTE: The Love Blueprint private-beta allowlist (user-ID-based gate) has been
// removed. Love Blueprint is now publicly purchasable. Authentication and
// payment/purchase entitlement are the only gates.
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

export type LaunchGateCode = 'launch_unavailable';

export interface LaunchGateResult {
  allowed: boolean;
  code?: LaunchGateCode;
}

/** Gate for the CHECKOUT route. Rejects non-launch types. No beta allowlist.
 * The _userId param is accepted for backward compatibility but ignored. */
export function gateCheckout(type: string, _userId?: string | number): LaunchGateResult {
  if (!isLaunchType(type)) {
    return { allowed: false, code: 'launch_unavailable' };
  }
  return { allowed: true };
}

/** Gate for the GENERATION route. Rejects non-launch types. No beta allowlist.
 * The _userId param is accepted for backward compatibility but ignored. */
export function gateGeneration(type: string, _userId?: string | number): LaunchGateResult {
  if (!isLaunchType(type)) {
    return { allowed: false, code: 'launch_unavailable' };
  }
  return { allowed: true };
}
