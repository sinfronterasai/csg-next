// Assembles the VerifiedFactsV2 ledger for a report type. Immutable asOfDate is
// captured once and reused on retry (no Date.now() drift). Reuses chartEngine for
// all astronomy; never recomputes in the writer.
//
// B1/B2: the report type is normalized + validated up front (no raw 'transit'
// alias slipping into the build/preflight); every derived fact — including
// chartRuler, moonPhase, tallies, and all scores/archetypes — is surfaced as a
// stable VerifiedFact, and the ledger fails closed if any provenance/driver id
// does not resolve (no dangling references ship).

import { computeVerifiedCommon } from './derived';
import {
  relationshipScores, loveBlueprintArchetype, vocationArchetype, karmicScores,
  validateScoreBands, type ScoreBand,
} from './scores';
import { preflightReport, validateFactResolution } from './schemas';
import { validateReportType, type VerifiedFactsV2, type ReportType, type VerifiedFact, type PreflightResult } from './types';

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

// Convert a score band into a stable VerifiedFact (kind 'score').
function scoreFact(id: string, band: ScoreBand): VerifiedFact {
  return {
    id,
    kind: 'score',
    source: 'derived-deterministic',
    display: `${id}: ${band.score}/100 — ${band.rule}`,
    value: { score: band.score, drivers: band.drivers, rule: band.rule },
    provenance: band.drivers,
  };
}

export class LedgerResolutionError extends Error {
  dangling: string[];
  constructor(dangling: string[]) {
    super(`verified-facts ledger has dangling provenance/driver ids: ${dangling.join(', ')}`);
    this.name = 'LedgerResolutionError';
    this.dangling = dangling;
  }
}

// Build the full ledger. `asOfDate` is optional; when omitted the build is
// "fresh", but callers that persist a snapshot must pass the stored asOfDate back
// on retry so the period and facts stay identical.
export async function buildVerifiedFactsV2(
  reportType: string,
  birth: BirthInput,
  asOfDate?: string,
): Promise<VerifiedFactsV2> {
  if (!validateReportType(reportType)) {
    throw new Error(`unknown report type: ${reportType}`);
  }
  const rt = reportType as ReportType;

  const common = await computeVerifiedCommon(birth);

  // Flatten positions + derived points + aspects + scores into the facts map.
  const facts: Record<string, VerifiedFact> = {};
  const push = (f: VerifiedFact) => { facts[f.id] = f; };
  for (const pos of common.positions) push(pos);
  for (const a of common.aspects) push(a);
  for (const p of common.patterns) push(p);
  // Surface every common.* derived fact as a stable VerifiedFact (B2).
  if (common.chartRuler) push(common.chartRuler);
  if (common.partOfFortune) push(common.partOfFortune);
  if (common.moonPhase) push(common.moonPhase);
  if (common.elements) push(common.elements);
  if (common.modalities) push(common.modalities);

  const reportData: Record<string, unknown> = {};
  if (rt === 'relationship' || rt === 'loveblueprint') {
    const rel = relationshipScores(common);
    const relValidate = validateScoreBands(rel as unknown as Record<string, ScoreBand>);
    if (!relValidate.ok) throw new Error(`relationship scores invalid: ${relValidate.errors.join('; ')}`);
    reportData.relationshipScores = rel;
    for (const [k, band] of Object.entries(rel)) push(scoreFact(`score.relationship.${k}`, band));
    if (rt === 'loveblueprint') {
      const arch = loveBlueprintArchetype(common);
      reportData.loveBlueprintArchetype = arch;
      push({ id: 'score.loveblueprint.archetype', kind: 'score', source: 'derived-deterministic',
        display: `Love blueprint ${arch.code} — ${arch.rule}`, value: arch, provenance: arch.drivers });
    }
  }
  if (rt === 'vocation') {
    const arch = vocationArchetype(common);
    reportData.vocationArchetype = arch;
    push({ id: 'score.vocation.archetype', kind: 'score', source: 'derived-deterministic',
      display: `Vocation ${arch.code} — ${arch.rule}`, value: arch, provenance: arch.drivers });
  }
  if (rt === 'karmicshadow') {
    const k = karmicScores(common);
    reportData.karmic = k;
    push({ id: 'score.karmic.axis', kind: 'score', source: 'derived-deterministic',
      display: `Karmic axis ${k.axis} — ${k.rule}`, value: k, provenance: k.drivers });
  }

  const ledger: VerifiedFactsV2 = {
    schemaVersion: 'csg-report-facts-v2',
    reportType: rt,
    asOfDate: asOfDate || todayISO(),
    common,
    facts,
    reportData,
  };

  // Fail closed on any dangling provenance / driver id (B2).
  const resolution = validateFactResolution(ledger);
  if (!resolution.ok) throw new LedgerResolutionError(resolution.dangling);

  return ledger;
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
  let ledger: VerifiedFactsV2;
  try {
    ledger = await buildVerifiedFactsV2(reportType, birth, asOfDate);
  } catch (e) {
    // Type/reolution errors are build failures, not incomplete-input: surface them.
    throw e;
  }
  const preflight = preflightReport(reportType, ledger);
  if (preflight.status !== 'complete') {
    return { ok: false, preflight };
  }
  return { ok: true, ledger };
}
