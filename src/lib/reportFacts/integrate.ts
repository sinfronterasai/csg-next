// Integration seam between the generate route and the VerifiedFactsV2 ledger.
// Builds the deterministic ledger and runs the report-specific preflight. On
// input_incomplete it returns the preflight so the caller can fail closed WITHOUT
// dispatching or consuming a purchase. No prose, no model math.

import { buildVerifiedFactsV2 } from './build';
import { preflightReport } from './schemas';
import type { ReportType, VerifiedFactsV2, PreflightResult } from './types';

export class V2PreflightError extends Error {
  preflight: PreflightResult;
  constructor(preflight: PreflightResult) {
    super('verified facts preflight failed');
    this.name = 'V2PreflightError';
    this.preflight = preflight;
  }
}

export interface BirthLike {
  name?: string;
  date: string;
  time?: string;
  location: string;
  unknownTime?: boolean;
}

export type V2BuildResult =
  | { ok: true; ledger: VerifiedFactsV2 }
  | { ok: false; preflight: PreflightResult };

export async function buildVerifiedFactsForReport(
  reportType: string,
  birth: BirthLike,
  asOfDate?: string,
): Promise<V2BuildResult> {
  const ledger = await buildVerifiedFactsV2(reportType, birth, asOfDate);
  const preflight = preflightReport(reportType as ReportType, ledger);
  if (preflight.status !== 'complete') {
    return { ok: false, preflight };
  }
  return { ok: true, ledger };
}
