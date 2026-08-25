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
