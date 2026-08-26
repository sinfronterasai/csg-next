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
import { relationshipEvidence, loveBlueprintEvidence, vocationEvidence, karmicEvidence, evidenceFact } from './evidence';
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

// R2-B8: asOfDate must be a real ISO date (YYYY-MM-DD). Reject garbage like
// 'not-a-date' so an invalid period can never be persisted.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidAsOfDate(d: string): boolean {
  if (!ISO_DATE.test(d)) return false;
  const t = Date.parse(d + 'T00:00:00Z');
  return !Number.isNaN(t);
}

// Convert a score band into a stable VerifiedFact (kind 'score').
function scoreFact(id: string, band: ScoreBand): VerifiedFact {
  return {
    id,
    kind: 'score',
    source: 'derived-deterministic',
    display: `${id}: ${band.value}/100 (${band.band}) — ${band.label}`,
    value: { value: band.value, drivers: band.drivers, label: band.label, band: band.band, rule: band.rule },
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
  if (asOfDate !== undefined && !isValidAsOfDate(asOfDate)) {
    throw new Error(`invalid asOfDate: ${asOfDate}`);
  }
  const rt = reportType as ReportType;

  const common = await computeVerifiedCommon(birth);

  // Flatten positions + derived points + aspects + scores into the facts map.
  const facts: Record<string, VerifiedFact> = {};
  const push = (f: VerifiedFact) => { facts[f.id] = f; };
  for (const pos of common.positions) push(pos);
  for (const a of common.aspects) push(a);
  for (const p of common.patterns) push(p);
  // Surface every common.* derived fact as a stable VerifiedFact (B2), including
  // the new house-structure facts (R2-B6) so the dangling gate can validate them.
  if (common.chartRuler) push(common.chartRuler);
  if (common.partOfFortune) push(common.partOfFortune);
  if (common.moonPhase) push(common.moonPhase);
  if (common.elements) push(common.elements);
  if (common.modalities) push(common.modalities);
  push(common.topAspectByBody);
  for (const h of common.houses ?? []) push({ id: `common.cusp.${h.num}`, kind: 'point', source: 'swiss-ephemeris', display: `House ${h.num} cusp ${h.signLabel}`, value: h, provenance: [] });
  for (const r of [common.rulers?.dsc, common.rulers?.second, common.rulers?.sixth, common.rulers?.tenth]) {
    if (r) push({ id: `common.ruler.${r.house}`, kind: 'point', source: 'derived-deterministic', display: `House ${r.house} ruler ${r.rulerLabel}`, value: r, provenance: r.provenance });
  }
  for (const o of common.occupants ?? []) push({ id: `common.occupants.${o.house}`, kind: 'point', source: 'derived-deterministic', display: `House ${o.house} occupants`, value: o, provenance: o.occupants.map((c) => c.positionId) });
  if (common.nodalRulers) {
    push({ id: 'common.nodalRuler.north', kind: 'point', source: 'derived-deterministic', display: 'North node ruler', value: common.nodalRulers.north, provenance: common.nodalRulers.north.provenance });
    push({ id: 'common.nodalRuler.south', kind: 'point', source: 'derived-deterministic', display: 'South node ruler', value: common.nodalRulers.south, provenance: common.nodalRulers.south.provenance });
  }

  const reportData: Record<string, unknown> = {};
  if (rt === 'relationship' || rt === 'loveblueprint') {
    const rel = relationshipScores(common);
    const relValidate = validateScoreBands(rel as unknown as Record<string, ScoreBand>);
    if (!relValidate.ok) throw new Error(`relationship scores invalid: ${relValidate.errors.join('; ')}`);
    reportData.relationshipScores = rel;
    for (const [k, band] of Object.entries(rel)) push(scoreFact(`score.relationship.${k}`, band));
    const relEv = relationshipEvidence(common);
    reportData.relationshipEvidence = relEv;
    // Provenance MUST reference the fact ids actually emitted above (score.relationship.<key>),
    // never the pre-fix dimension names. Derive from the real keys so the dangling gate passes.
    const relScoreIds = Object.keys(rel).map((k) => `score.relationship.${k}`);
    push(evidenceFact('reportData.relationshipEvidence', relEv, ['common.ruler.7', 'common.occupants.7', ...relScoreIds]));
    if (rt === 'loveblueprint') {
      const arch = loveBlueprintArchetype(common);
      reportData.loveBlueprintArchetype = arch;
      push({ id: 'score.loveblueprint.archetype', kind: 'score', source: 'derived-deterministic',
        display: `Love blueprint ${arch.code} — ${arch.rule}`, value: arch, provenance: arch.drivers });
      const lbEv = loveBlueprintEvidence(common);
      reportData.loveBlueprintEvidence = lbEv;
      push(evidenceFact('reportData.loveBlueprintEvidence', lbEv, ['common.ruler.7', 'common.occupants.7', 'score.loveblueprint.archetype', 'natal.northnode.position']));
    }
  }
  if (rt === 'vocation') {
    const arch = vocationArchetype(common);
    reportData.vocationArchetype = arch;
    push({ id: 'score.vocation.archetype', kind: 'score', source: 'derived-deterministic',
      display: `Vocation ${arch.code} — ${arch.rule}`, value: arch, provenance: arch.drivers });
    const vocEv = vocationEvidence(common);
    reportData.vocationEvidence = vocEv;
    push(evidenceFact('reportData.vocationEvidence', vocEv, ['common.ruler.10', 'common.ruler.2', 'common.ruler.6', 'score.vocation.archetype']));
  }
  if (rt === 'karmicshadow') {
    const k = karmicScores(common);
    reportData.karmic = k;
    push({ id: 'score.karmic.axis', kind: 'score', source: 'derived-deterministic',
      display: `Karmic axis ${k.axis} — ${k.rule}`, value: k, provenance: k.drivers });
    const karEv = karmicEvidence(common);
    reportData.karmicEvidence = karEv;
    push(evidenceFact('reportData.karmicEvidence', karEv, ['common.nodalRuler.north', 'common.nodalRuler.south', 'score.karmic.axis']));
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
