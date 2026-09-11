import { NextResponse } from 'next/server';
import {
  getReadingByReportId, applyPipelineCallback, canonicalCallbackHash,
  type PipelineStatus,
} from '@/lib/profile/store';
import { verifyCallbackToken, convertCompactCallback } from '@/lib/reportPipeline';
import { compilePremiumNatalReport } from '@/lib/deterministicReportCompiler';

// POST /api/reports/pipeline-complete
// n8n calls this with the generated/approved/rejected report. The app is the
// system of record; we NEVER accept a callback-supplied user id. Ownership is
// resolved from the existing reading row keyed by the app-generated reportId.
//
// Privacy: no birth data, verifiedFacts, bearer values, or full report prose is
// logged here. We only log coarse status transitions.

// Pipeline callbacks are automated outcomes. `needs_editor` remains an internal
// legacy state for privileged tools, but a writer callback must never create a
// standing human-review queue.
const VALID_STATUSES = new Set(['approved', 'rejected']);
const MAX_BODY_BYTES = 1_000_000; // 1 MB hard cap on callback payloads.

type CallbackBlockRole = 'evidence' | 'meaning' | 'synthesis' | 'agency';
interface CallbackBlock { role: CallbackBlockRole; prose: string; factIds: string[] }
interface CallbackSection { id: string; blocks: CallbackBlock[] }
interface StoredCallbackSection extends CallbackSection { prose: string }
interface CallbackBody {
  reportId?: string;
  status?: string;
  reportType?: string;
  sections?: CallbackSection[];
  judge?: Record<string, unknown>;
  editorNote?: string | null;
  rejectReasons?: string[];
  schemaVersion?: string;
  skeleton?: unknown;
  tables?: unknown;
  blocks?: unknown;
}

const BODY_KEYS = new Set(['reportId', 'status', 'reportType', 'sections', 'judge', 'editorNote', 'rejectReasons', 'schemaVersion', 'skeleton', 'tables', 'blocks']);
const SECTION_KEYS = new Set(['id', 'blocks']);
const BLOCK_KEYS = new Set(['role', 'prose', 'factIds']);
const BLOCK_ROLES = new Set<CallbackBlockRole>(['evidence', 'meaning', 'synthesis', 'agency']);

function hasExactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidBlock(value: unknown): value is CallbackBlock {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  if (!hasExactKeys(block, BLOCK_KEYS)) return false;
  if (!BLOCK_ROLES.has(block.role as CallbackBlockRole) || !isNonBlankString(block.prose)) return false;
  return Array.isArray(block.factIds) && block.factIds.length > 0 && block.factIds.every(isNonBlankString);
}

function isValidSection(value: unknown): value is CallbackSection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const section = value as Record<string, unknown>;
  if (!hasExactKeys(section, SECTION_KEYS) || !isNonBlankString(section.id)) return false;
  return Array.isArray(section.blocks) && section.blocks.length > 0 && section.blocks.every(isValidBlock);
}

function normalizeSections(sections: CallbackSection[]): StoredCallbackSection[] {
  return sections.map((section) => ({
    id: section.id,
    prose: section.blocks.map((block) => block.prose).join('\n\n'),
    blocks: section.blocks,
  }));
}

export async function POST(request: Request) {
  // R2.1 — reject absent/incorrect callback bearer token.
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyCallbackToken(provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // R7 — enforce ACTUAL payload size regardless of (or absent) Content-Length.
  // Read bounded text first; if it exceeds the cap, reject before parsing.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let body: CallbackBody;
  try {
    body = JSON.parse(raw);
  } catch {
    // R2.3 — malformed callback returns 400.
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body) || !hasExactKeys(body as Record<string, unknown>, BODY_KEYS)) {
    return NextResponse.json({ error: 'Invalid callback body' }, { status: 400 });
  }

  const { reportId, status, sections, judge, editorNote, rejectReasons, schemaVersion } = body;
  const isCompact = schemaVersion === 'csg-compact-report-callback-v1';
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  if ((!isCompact && ['schemaVersion', 'skeleton', 'tables', 'blocks'].some(hasOwn)) ||
      (isCompact && ['sections', 'judge', 'editorNote'].some(hasOwn))) {
    return NextResponse.json({ error: 'Invalid callback contract' }, { status: 400 });
  }

  // R2.2 — validate body and known reportId before mutation.
  if (!isNonBlankString(reportId)) {
    return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const standardSections = sections ?? [];
  if (!isCompact && (!Array.isArray(sections) || !sections.every(isValidSection))) {
    return NextResponse.json({ error: 'Invalid sections' }, { status: 400 });
  }
  if (!isCompact && new Set(standardSections.map((section) => section.id)).size !== standardSections.length) {
    return NextResponse.json({ error: 'Duplicate section id' }, { status: 400 });
  }
  if (judge !== undefined && (typeof judge !== 'object' || judge === null || Array.isArray(judge))) {
    return NextResponse.json({ error: 'Invalid judge' }, { status: 400 });
  }
  if (editorNote !== undefined && editorNote !== null && typeof editorNote !== 'string') {
    return NextResponse.json({ error: 'Invalid editorNote' }, { status: 400 });
  }
  if (rejectReasons !== undefined && (!Array.isArray(rejectReasons) || !rejectReasons.every(isNonBlankString))) {
    return NextResponse.json({ error: 'Invalid rejectReasons' }, { status: 400 });
  }

  // R7 — contract-required content per status.
  if (status === 'approved' && !isCompact) {
    if (standardSections.length === 0 || !judge || typeof judge !== 'object') {
      return NextResponse.json({ error: 'Approved callbacks require sections and judge' }, { status: 400 });
    }
  }
  if (status === 'rejected' && !isCompact) {
    if (!Array.isArray(rejectReasons) || rejectReasons.length === 0) {
      return NextResponse.json({ error: 'Rejected callbacks require rejectReasons' }, { status: 400 });
    }
  }

  const existing = await getReadingByReportId(reportId);
  if (!existing) {
    // R2.2 — unknown reportId -> 404 (never create a record from a callback).
    return NextResponse.json({ error: 'Unknown reportId' }, { status: 404 });
  }

  let callbackSections = sections ?? [];
  let callbackJudge = judge;
  let callbackRejectReasons = Array.isArray(rejectReasons) ? rejectReasons : [];
  if (isCompact) {
    try {
      const storedResult = typeof existing.result === 'string' ? JSON.parse(existing.result) : (existing.result ?? {});
      const ledger = storedResult?.verifiedFacts ?? storedResult?.metadata?.verifiedFacts;
      const mapped = convertCompactCallback(body, { reportId, compiled: compilePremiumNatalReport(ledger) });
      callbackSections = mapped.sections;
      callbackJudge = mapped.judge;
      callbackRejectReasons = mapped.rejectReasons;
    } catch {
      return NextResponse.json({ error: 'Invalid compact callback' }, { status: 400 });
    }
  }

  // Compact callbacks are converted into the existing app contract. Their
  // deterministic tables/skeleton are deliberately not copied into pipeline state.
  const normalizedSections = normalizeSections(callbackSections);
  const callbackHash = canonicalCallbackHash({
    status,
    sections: normalizedSections,
    judge: callbackJudge ?? null,
    editorNote: editorNote ?? null,
    rejectReasons: callbackRejectReasons,
  });

  // R2.5 — build the inner pipeline object (NOT nested). applyPipelineCallback
  // writes this directly at result.pipeline.
  const pipelineValue: Record<string, unknown> = {
    status,
    sections: normalizedSections,
    judge: callbackJudge ?? null,
    editorNote: editorNote ?? null,
    rejectReasons: callbackRejectReasons,
    completedAt: new Date().toISOString(),
  };

  const outcome = await applyPipelineCallback({
    reportId,
    status: status as PipelineStatus,
    pipelineValue,
    callbackHash,
  });

  switch (outcome) {
    case 'applied':
      // Coarse status only — no PII, no facts, no bearer.
      return NextResponse.json({ success: true, status });
    case 'duplicate':
      return NextResponse.json({ success: true, status, duplicate: true });
    case 'conflict':
      return NextResponse.json({ error: 'Conflicting duplicate callback' }, { status: 409 });
    case 'regression':
      return NextResponse.json({ error: 'Terminal state cannot regress' }, { status: 409 });
    case 'not_found':
      return NextResponse.json({ error: 'Unknown reportId' }, { status: 404 });
  }
}
