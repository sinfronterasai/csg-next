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
import { buildNarrativeFactPacks, compilePremiumNatalReport, type PremiumNatalCompilation } from './deterministicReportCompiler';

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
  /** Compact compiler-owned input for the writer; never includes the full ledger. */
  writerInput?: { narrativeFactPacks: unknown[]; deterministic?: { tables: unknown; skeleton: unknown } };
  promptSlug: string;
  /** Override callback URL (tests use this). Falls back to CSG_REPORT_CALLBACK_URL. */
  callbackUrl?: string;
  /** Compiler output supplied by the app for the compact child. */
  compiled?: PremiumNatalCompilation;
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
  // Free Natal and Premium Natal deliberately share the same verified-facts
  // pipeline child; entitlement determines the tier, not the chart facts.
  if (appType === 'natalpremium') return 'natal';
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

export type PremiumNatalWorkflow = 'legacy' | 'compact';

/** Compact is opt-in; all products/configurations otherwise use legacy. */
export function getPremiumNatalWorkflow(env: Record<string, string | undefined> = process.env, reportType?: string): PremiumNatalWorkflow {
  return reportType === 'natalpremium' && env.N8N_PREMIUM_NATAL_WORKFLOW === 'compact' ? 'compact' : 'legacy';
}

export type CompactCallbackBlock = { role: 'narrative' | 'reflection' | 'practical'; prose: string; factIds: string[] };
export type CompactCallback = {
  schemaVersion: 'csg-compact-report-callback-v1'; reportId: string; status: 'approved' | 'rejected'; reportType: 'natal';
  skeleton: unknown; tables: unknown; blocks: Array<{ sectionId: string; blocks: CompactCallbackBlock[] }>; rejectReasons?: string[];
};
function compactFail(message: string): never { throw new Error(`invalid compact callback: ${message}`); }

/** Map the private compact contract; deterministic tables never cross into app pipeline state. */
export function convertCompactCallback(value: unknown, expected: { reportId: string; compiled: PremiumNatalCompilation }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) compactFail('body');
  const callback = value as Partial<CompactCallback>;
  if (callback.schemaVersion !== 'csg-compact-report-callback-v1' || callback.reportId !== expected.reportId) compactFail('schema or correlation');
  if (callback.reportType !== 'natal' || !['approved', 'rejected'].includes(callback.status as string)) compactFail('status');
  if (!callback.tables || !callback.skeleton) compactFail('deterministic snapshot');
  if (callback.status === 'rejected') {
    if (!Array.isArray(callback.rejectReasons) || callback.rejectReasons.length === 0 || callback.rejectReasons.some((r) => typeof r !== 'string' || !r.trim())) compactFail('rejection reasons');
    return { reportId: expected.reportId, status: 'rejected' as const, sections: [], judge: undefined, rejectReasons: callback.rejectReasons };
  }
  const slots = expected.compiled.narrativeSlots;
  if (!Array.isArray(callback.blocks) || callback.blocks.length !== slots.length) compactFail('complete slots');
  const byId = new Map(callback.blocks.map((block) => [block.sectionId, block]));
  if (byId.size !== slots.length || slots.some((slot) => !byId.has(slot.id))) compactFail('slot allowlist');
  const roleMap = { narrative: 'meaning', reflection: 'synthesis', practical: 'agency' } as const;
  const sections = slots.map((slot) => {
    const block = byId.get(slot.id)!;
    if (!Array.isArray(block.blocks) || block.blocks.length === 0) compactFail(`missing blocks for ${slot.id}`);
    const allowedFacts = new Set(slot.relevantFactIds);
    return { id: slot.id, blocks: block.blocks.map((item) => {
      if (!item || !['narrative', 'reflection', 'practical'].includes(item.role) || typeof item.prose !== 'string' || !item.prose.trim() || !Array.isArray(item.factIds) || item.factIds.length === 0 || item.factIds.some((id) => typeof id !== 'string' || !allowedFacts.has(id))) compactFail(`unsupported block for ${slot.id}`);
      return { role: roleMap[item.role], prose: item.prose, factIds: [...item.factIds] };
    }) };
  });
  return { reportId: expected.reportId, status: 'approved' as const, sections, judge: { source: 'compact' }, rejectReasons: [] };
}

export function buildDispatchPayload(input: DispatchInput, workflow: PremiumNatalWorkflow = getPremiumNatalWorkflow(process.env, input.reportType)) {
  const contractType = mapReportType(input.reportType);
  if (!contractType) throw new Error(`Unsupported n8n reportType: ${input.reportType}`);
  if (workflow === 'compact') {
    if (input.reportType !== 'natalpremium') throw new Error('Compact workflow is Premium Natal only');
    const compiled = input.compiled ?? compilePremiumNatalReport(input.verifiedFacts as any);
    return { reportId: input.reportId, reportType: 'natal' as const, tier: input.tier, birthData: input.birthData, verifiedFacts: input.verifiedFacts,
      deterministic: { schemaVersion: compiled.schemaVersion, skeleton: { metadata: compiled.metadata, narrativeSlots: compiled.narrativeSlots }, tables: compiled.tables },
      narrativeFactPacks: buildNarrativeFactPacks(compiled), promptSlug: input.promptSlug || PROMPT_SLUG[contractType], callbackUrl: input.callbackUrl };
  }
  return { reportId: input.reportId, reportType: contractType, tier: input.tier, birthData: input.birthData, verifiedFacts: input.verifiedFacts, writerInput: input.writerInput, promptSlug: input.promptSlug || PROMPT_SLUG[contractType], callbackUrl: input.callbackUrl };
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

  const workflow = getPremiumNatalWorkflow(process.env, input.reportType);
  const webhookUrl = workflow === 'compact' ? requireEnv('N8N_COMPACT_REPORT_WEBHOOK_URL') : requireEnv('N8N_REPORT_WEBHOOK_URL');
  const token = requireEnv('REPORT_PIPELINE_TOKEN');
  const callbackUrl = input.callbackUrl ?? requireEnv('CSG_REPORT_CALLBACK_URL');

  const payload = buildDispatchPayload({ ...input, callbackUrl }, workflow);

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

// --- R3: editor decision ------------------------------------------------------

export interface EditorDecisionInput {
  reportId: string;
  decision: 'approved' | 'rejected';
  editorNote?: string;
  reviewer: string;
  callbackUrl?: string;
}

export async function sendEditorDecision(
  input: EditorDecisionInput,
): Promise<{ ok: boolean; status: number }> {
  const webhookUrl = requireEnv('N8N_EDITOR_WEBHOOK_URL');
  const token = requireEnv('REPORT_PIPELINE_TOKEN');
  const callbackUrl = input.callbackUrl ?? requireEnv('CSG_REPORT_CALLBACK_URL');

  const payload = {
    reportId: input.reportId,
    decision: input.decision,
    editorNote: input.editorNote ?? '',
    reviewer: input.reviewer,
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
    return { ok: res.ok, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

// --- Status helpers (shared state machine) ------------------------------------

export const TERMINAL_STATES = new Set(['approved', 'rejected']);

/** Whether a report in `current` may legally transition to `next`. */
export function canTransition(current: string | null, next: string): boolean {
  // Automated quality gates finish directly as approved or rejected.
  if (next === 'needs_editor') return false;
  // Initial dispatch states (queued/processing/null) can move through the normal path.
  if (current === null || current === 'queued' || current === 'processing' || current === 'checking') {
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
