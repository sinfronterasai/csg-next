// Assembles the VerifiedFactsV2 ledger for a report type. Immutable asOfDate is
// captured once and reused on retry (no Date.now() drift). Reuses chartEngine for
// all astronomy; never recomputes in the writer.

import { computeVerifiedCommon, computeBodyLongitude } from './derived';
import {
  relationshipScores, loveBlueprintArchetype, vocationArchetype, karmicScores,
} from './scores';
import { preflightReport } from './schemas';
import type { VerifiedFactsV2, ReportType, VerifiedFact, PreflightResult } from './types';

export interface BirthInput {
  name?: string;
  date: string;
  time?: string;
  location: string;
  unknownTime?: boolean;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Build the full ledger. `asOfDate` is optional; when omitted the build is
// "fresh", but callers that persist a snapshot must pass the stored asOfDate back
// on retry so the period and facts stay identical.
export async function buildVerifiedFactsV2(
  reportType: string,
  birth: BirthInput,
  asOfDate?: string,
): Promise<VerifiedFactsV2> {
  const common = await computeVerifiedCommon(birth);

  // Flatten positions + derived points + aspects into the facts map.
  const facts: Record<string, VerifiedFact> = {};
  const push = (f: VerifiedFact) => { facts[f.id] = f; };
  // Surface every computed position with its stable id (e.g. natal.sun.position)
  // so preflight and the writer can reference exact facts.
  for (const pos of common.positions) push(pos);
  for (const a of common.aspects) push(a);
  for (const p of common.patterns) push(p);

  const reportData: Record<string, unknown> = {};
  if (reportType === 'relationship' || reportType === 'loveblueprint') {
    const rel = relationshipScores(common);
    reportData.relationshipScores = rel;
    if (reportType === 'loveblueprint') {
      reportData.loveBlueprintArchetype = loveBlueprintArchetype(common);
    }
  }
  if (reportType === 'vocation') {
    reportData.vocationArchetype = vocationArchetype(common);
  }
  if (reportType === 'karmicshadow') {
    reportData.karmic = karmicScores(common);
  }

  return {
    schemaVersion: 'csg-report-facts-v2',
    reportType: reportType as ReportType,
    asOfDate: asOfDate || todayISO(),
    common,
    facts,
    reportData,
  };
}

export interface BuildOutcome {
  ok: boolean;
  ledger?: VerifiedFactsV2;
  preflight?: PreflightResult;
}

// Build + preflight in one step. Returns ok:false + preflight on incomplete so the
// caller can fail closed without dispatching.
export async function buildAndPreflight(
  reportType: ReportType,
  birth: BirthInput,
  asOfDate?: string,
): Promise<BuildOutcome> {
  const ledger = await buildVerifiedFactsV2(reportType, birth, asOfDate);
  const preflight = preflightReport(reportType, ledger);
  if (preflight.status !== 'complete') {
    return { ok: false, preflight };
  }
  return { ok: true, ledger };
}
