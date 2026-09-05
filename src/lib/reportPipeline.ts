// Server-only n8n report pipeline client (R1 dispatcher + R3 editor path).
//
// Responsibilities (per n8n-integration-contract.md and PIKE-REPORT-INTEGRATION-BRIEF.md):
//  - Build the EXACT contract payload and POST it to n8n's report-generate webhook.
//  - Map the app's internal report type to the n8n contract type (transit -> yearlytransit).
//  - Reject unsupported/two-person/tarot types from this route.
//  - Send editor decisions to the editor-decision webhook.
//  - Never log birth data, verified facts, or bearer tokens.
//
// This module is intentionally free of Next.js imports so it can be unit-tested
// under the plain Node test environment with a stubbed fetch.

import crypto from 'crypto';

// --- Contract types -----------------------------------------------------------

/** n8n contract reportType values (solo MVP only). */
export type N8nReportType =
  | 'natal'
  | 'relationship'
  | 'loveblueprint'
  | 'lovetiming'
  | 'yearlytransit'
  | 'vocation'
  | 'karmicshadow'
  | 'fullcosmic';

export type PipelineTier = 'free' | 'paid';

export interface BirthDataPayload {
  firstName?: string;
  dob: string;
  birthTime: string | null;
  place: string;
  lat: number;
  lon: number;
  tz: string;
  solarFallback: boolean;
}

export interface DispatchInput {
  reportId: string; // app-generated correlation UUID
  /** App-internal type; mapped to the n8n contract type. */
  reportType: string;
  tier: PipelineTier;
  birthData: BirthDataPayload;
  verifiedFacts: Record<string, unknown>;
  promptSlug: string;
  /** Override callback URL (tests use this). Falls back to CSG_REPORT_CALLBACK_URL. */
  callbackUrl?: string;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  reportId: string;
}

// --- Type mapping -------------------------------------------------------------

/** App internal type -> n8n contract type (the only remap is transit -> yearlytransit). */
export function mapReportType(appType: string): N8nReportType | null {
  if (appType === 'transit') return 'yearlytransit';
  const allowed: N8nReportType[] = [
    'natal', 'relationship', 'loveblueprint', 'lovetiming',
    'yearlytransit', 'vocation', 'karmicshadow', 'fullcosmic',
  ];
  return (allowed as string[]).includes(appType)
    ? (appType as N8nReportType)
    : null;
}

/** Types excluded from the solo MVP n8n route (deferred two-person / app-driven tarot). */
export function isUnsupportedForPipeline(appType: string): boolean {
  return ['synastry', 'composite', 'couples', 'tarot'].includes(appType);
}

/** Prompt slug by contract type, used to load the writer system prompt in n8n. */
export const PROMPT_SLUG: Record<N8nReportType, string> = {
  natal: '01-natal',
  relationship: '02-relationship-matrix',
  loveblueprint: '03-love-blueprint',
  lovetiming: '04-love-timing',
  yearlytransit: '08-yearly-transit',
  vocation: '09-vocation-wealth',
  karmicshadow: '10-karmic-shadow',
  fullcosmic: '11-full-cosmic-bundle',
};

// --- Config ------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// --- Network (injectable for tests) -------------------------------------------

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = fetch;
export function __setFetch(fn: FetchLike) { fetchImpl = fn; }

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifyCallbackToken(provided: string | null | undefined): boolean {
  const expected = process.env.REPORT_CALLBACK_TOKEN;
  if (!expected) return false;
  if (!provided) return false;
  return timingSafeEqual(provided, expected);
}

// --- R1: dispatcher -----------------------------------------------------------

export async function dispatchReport(input: DispatchInput): Promise<DispatchResult> {
  if (isUnsupportedForPipeline(input.reportType)) {
    throw new Error(`Report type '${input.reportType}' is not dispatched via the n8n pipeline`);
  }
  const contractType = mapReportType(input.reportType);
  if (!contractType) {
    throw new Error(`Unsupported n8n reportType: ${input.reportType}`);
  }

  const webhookUrl = requireEnv('N8N_REPORT_WEBHOOK_URL');
  const token = requireEnv('REPORT_PIPELINE_TOKEN');
  const callbackUrl = input.callbackUrl ?? requireEnv('CSG_REPORT_CALLBACK_URL');

  const payload = {
    reportId: input.reportId,
    reportType: contractType,
    tier: input.tier,
    birthData: input.birthData,
    verifiedFacts: input.verifiedFacts,
    promptSlug: input.promptSlug || PROMPT_SLUG[contractType],
    callbackUrl,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, reportId: input.reportId };
  } finally {
    clearTimeout(timeout);
  }
}

// --- R6.5: private editor escalation -----------------------------------------

export type EditorAction = 'approve' | 'reject' | 'resubmit' | 'regenerate';
export interface SafeReportSection { id: string; prose: string; factsCited: string[] }
export type QualityIssueCategory = 'factual' | 'structure' | 'specificity' | 'narrative' | 'tone' | 'duplication' | 'length' | 'safety';
export interface QualityRecoveryArtifactV1 {
  version: 1;
  candidateHash: string;
  attemptCount: number;
  failedSections: string[];
  issues: Array<{ section: string; category: QualityIssueCategory; repairable: boolean; problem: string; requiredFix: string; factIds: string[] }>;
  hardGates: { factual: boolean; banned: boolean; specific: boolean; dup: boolean; tone: boolean; structure: boolean; length: boolean; ageConsent: boolean };
  scores: { precision: number; insightDensity: number; voiceFit: number; empowerment: number; personalization: number; clarity: number; cohesion: number; narrativeDepth: number };
  judgeSchemaValid: boolean;
  hardGatesPassed: boolean;
}

const ARTIFACT_KEYS = ['version','candidateHash','attemptCount','failedSections','issues','hardGates','scores','judgeSchemaValid','hardGatesPassed'].sort();
const GATE_KEYS = ['factual','banned','specific','dup','tone','structure','length','ageConsent'].sort();
const SCORE_KEYS = ['precision','insightDensity','voiceFit','empowerment','personalization','clarity','cohesion','narrativeDepth'].sort();
const ISSUE_KEYS = ['section','category','repairable','problem','requiredFix','factIds'].sort();
const ISSUE_CATEGORIES = new Set<QualityIssueCategory>(['factual','structure','specificity','narrative','tone','duplication','length','safety']);
const SHA256_RE = /^[a-f0-9]{64}$/;

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join('|') === expected.join('|');
}
function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}
function uniqueBoundedStrings(value: unknown, maxLength: number): value is string[] {
  return Array.isArray(value) && value.every((v) => boundedString(v, 1, maxLength)) && new Set(value).size === value.length;
}

/** Validate the locked quality-recovery-artifact.v1 schema without permissive coercion. */
export function validateQualityRecoveryArtifact(value: unknown): QualityRecoveryArtifactV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const a = value as Record<string, any>;
  if (!exactKeys(a, ARTIFACT_KEYS) || a.version !== 1 || !SHA256_RE.test(a.candidateHash)) return null;
  if (!Number.isInteger(a.attemptCount) || a.attemptCount < 0 || a.attemptCount > 2) return null;
  if (!uniqueBoundedStrings(a.failedSections, 120)) return null;
  if (typeof a.judgeSchemaValid !== 'boolean' || typeof a.hardGatesPassed !== 'boolean') return null;
  if (!a.hardGates || typeof a.hardGates !== 'object' || Array.isArray(a.hardGates) || !exactKeys(a.hardGates, GATE_KEYS)) return null;
  if (!GATE_KEYS.every((k) => typeof a.hardGates[k] === 'boolean')) return null;
  if (!a.scores || typeof a.scores !== 'object' || Array.isArray(a.scores) || !exactKeys(a.scores, SCORE_KEYS)) return null;
  if (!SCORE_KEYS.every((k) => Number.isInteger(a.scores[k]) && a.scores[k] >= 1 && a.scores[k] <= 5)) return null;
  if (!Array.isArray(a.issues)) return null;
  for (const raw of a.issues) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !exactKeys(raw, ISSUE_KEYS)) return null;
    if (!boundedString(raw.section, 1, 120) || !ISSUE_CATEGORIES.has(raw.category) || typeof raw.repairable !== 'boolean') return null;
    if (!boundedString(raw.problem, 1, 500) || !boundedString(raw.requiredFix, 1, 500) || !uniqueBoundedStrings(raw.factIds, 180)) return null;
  }
  return a as QualityRecoveryArtifactV1;
}

export function normalizeSafeReportSections(sections: unknown): SafeReportSection[] | null {
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 100) return null;
  const out: SafeReportSection[] = [];
  const ids = new Set<string>();
  for (const raw of sections) {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (!boundedString(s.id, 1, 120) || !boundedString(s.prose, 1, 20_000) || ids.has(s.id)) return null;
    const facts = s.factsCited === undefined ? [] : s.factsCited;
    if (!uniqueBoundedStrings(facts, 180) || facts.length > 100) return null;
    ids.add(s.id);
    out.push({ id: s.id, prose: s.prose, factsCited: facts });
  }
  return out;
}

/** Hash only the exact judged candidate section contract, preserving section order. */
export function hashReportSections(sections: unknown): string {
  const safe = normalizeSafeReportSections(sections);
  if (!safe) return '';
  return crypto.createHash('sha256').update(JSON.stringify(safe)).digest('hex');
}

export function qualityArtifactProvesPass(value: unknown, tier: PipelineTier, sections: unknown): boolean {
  const a = validateQualityRecoveryArtifact(value);
  if (!a || !a.judgeSchemaValid || !a.hardGatesPassed || a.failedSections.length !== 0) return false;
  if (!Object.values(a.hardGates).every((v) => v === true)) return false;
  const threshold = tier === 'paid' ? 4 : 3;
  if (!Object.values(a.scores).every((v) => v >= threshold)) return false;
  const candidateHash = hashReportSections(sections);
  return candidateHash.length === 64 && crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(a.candidateHash));
}

export interface EditorActionInput {
  reportId: string;
  reportType: 'natal' | 'loveblueprint';
  tier: PipelineTier;
  action: EditorAction;
  reviewer: string;
  editorNote?: string;
  currentSections: SafeReportSection[];
  correctedSections?: SafeReportSection[];
  regenerateSectionIds?: string[];
  qualityArtifact: QualityRecoveryArtifactV1;
  verifiedFacts: Record<string, unknown>;
  callbackUrl?: string;
}

export function editorActionIdempotencyKey(input: EditorActionInput): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    reportId: input.reportId, reportType: input.reportType, tier: input.tier, action: input.action,
    reviewer: input.reviewer, editorNote: input.editorNote ?? '', currentSections: input.currentSections,
    correctedSections: input.correctedSections ?? [], regenerateSectionIds: input.regenerateSectionIds ?? [],
    qualityArtifact: input.qualityArtifact,
  })).digest('hex');
}

export async function sendEditorAction(input: EditorActionInput): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = requireEnv('N8N_EDITOR_WEBHOOK_URL');
  const token = requireEnv('REPORT_PIPELINE_TOKEN');
  const callbackUrl = input.callbackUrl ?? requireEnv('CSG_REPORT_CALLBACK_URL');
  const payload = {
    reportId: input.reportId, reportType: input.reportType, tier: input.tier, action: input.action,
    reviewer: input.reviewer, editorNote: input.editorNote ?? '', currentSections: input.currentSections,
    correctedSections: input.correctedSections ?? [], regenerateSectionIds: input.regenerateSectionIds ?? [],
    qualityArtifact: input.qualityArtifact, verifiedFacts: input.verifiedFacts, callbackUrl,
    idempotencyKey: editorActionIdempotencyKey(input),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

// Compatibility shim for the pre-R6.5 paid-only caller/tests.
export interface EditorDecisionInput { reportId: string; decision: 'approved' | 'rejected'; editorNote?: string; reviewer: string; callbackUrl?: string }
export async function sendEditorDecision(input: EditorDecisionInput): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = requireEnv('N8N_EDITOR_WEBHOOK_URL');
  const token = requireEnv('REPORT_PIPELINE_TOKEN');
  const callbackUrl = input.callbackUrl ?? requireEnv('CSG_REPORT_CALLBACK_URL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...input, callbackUrl }), signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } finally { clearTimeout(timeout); }
}

// --- Status helpers (shared state machine) ------------------------------------

export const TERMINAL_STATES = new Set(['approved', 'rejected']);

/** Whether a report in `current` may legally transition to `next`. */
export function canTransition(current: string | null, next: string): boolean {
  // Initial dispatch states (queued/processing/null) can move to any pipeline status.
  if (current === null || current === 'queued' || current === 'processing') {
    return true;
  }
  // Terminal states never regress.
  if (TERMINAL_STATES.has(current)) return current === next;
  // needs_editor may go to approved/rejected (editor decision), but not back to needs_editor.
  if (current === 'needs_editor') {
    return next === 'approved' || next === 'rejected';
  }
  return false;
}
