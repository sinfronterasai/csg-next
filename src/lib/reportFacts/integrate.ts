// Integration seam between the generate route and the VerifiedFactsV2 ledger.
// Builds the deterministic ledger and runs the report-specific preflight. On
// input_incomplete it returns the preflight so the caller can fail closed WITHOUT
// dispatching or consuming a purchase. No prose, no model math.
//
// B1: the report type is validated before build, so a raw 'transit' alias (or any
// unknown type) throws instead of silently building under the wrong contract.

import { buildVerifiedFactsV2, LedgerResolutionError } from './build';
import { preflightReport } from './schemas';
import { validateReportType, type ReportType, type VerifiedFactsV2, type PreflightResult } from './types';

export class V2PreflightError extends Error {
  preflight: PreflightResult;
  constructor(preflight: PreflightResult) {
    super('verified facts preflight failed');
    this.name = 'V2PreflightError';
    this.preflight = preflight;
  }
}

// Thrown when the build itself fails (unknown type, dangling fact resolution) —
// distinct from an input_incomplete preflight. The route maps it to 400.
export class V2BuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'V2BuildError';
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
  if (!validateReportType(reportType)) {
    throw new V2BuildError(`unknown report type: ${reportType}`);
  }
  let ledger: VerifiedFactsV2;
  try {
    ledger = await buildVerifiedFactsV2(reportType, birth, asOfDate);
  } catch (e) {
    if (e instanceof LedgerResolutionError) throw new V2BuildError(e.message);
    throw e;
  }
  const preflight = preflightReport(reportType as ReportType, ledger);
  if (preflight.status !== 'complete') {
    return { ok: false, preflight };
  }
  return { ok: true, ledger };
}
