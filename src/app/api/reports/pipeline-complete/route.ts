import { NextResponse } from 'next/server';
import {
  getReadingByReportId, applyPipelineCallback, canonicalCallbackHash,
  type UniversalReadingRecord, type PipelineStatus,
} from '@/lib/profile/store';
import { verifyCallbackToken, hashReportSections, qualityArtifactProvesPass, validateQualityRecoveryArtifact } from '@/lib/reportPipeline';

// POST /api/reports/pipeline-complete
// n8n calls this with the generated/approved/rejected report. The app is the
// system of record; we NEVER accept a callback-supplied user id. Ownership is
// resolved from the existing reading row keyed by the app-generated reportId.
//
// Privacy: no birth data, verifiedFacts, bearer values, or full report prose is
// logged here. We only log coarse status transitions.

const VALID_STATUSES = new Set(['approved', 'needs_editor', 'rejected']);
const MAX_BODY_BYTES = 1_000_000; // 1 MB hard cap on callback payloads.

interface CallbackSection { id?: string; prose?: string; factsCited?: string[] }
interface CallbackBody {
  reportId?: string;
  status?: string;
  sections?: CallbackSection[];
  judge?: Record<string, unknown>;
  qualityArtifact?: Record<string, unknown>;
  idempotencyKey?: string;
  editorNote?: string;
  rejectReasons?: string[];
}

function currentStatus(rec: UniversalReadingRecord | null): string | null {
  if (!rec) return null;
  const pipeline = (rec.result?.pipeline as { status?: string } | undefined);
  return pipeline?.status ?? rec.pipelineStatus ?? null;
}

function isValidSection(s: unknown): s is CallbackSection {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  if (o.id !== undefined && typeof o.id !== 'string') return false;
  if (o.prose !== undefined && typeof o.prose !== 'string') return false;
  if (o.factsCited !== undefined) {
    if (!Array.isArray(o.factsCited)) return false;
    if (!o.factsCited.every((f) => typeof f === 'string')) return false;
  }
  return true;
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

  const { reportId, status, sections, judge, qualityArtifact, idempotencyKey, editorNote, rejectReasons } = body;

  // R2.2 — validate body and known reportId before mutation.
  if (!reportId || typeof reportId !== 'string') {
    return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{64}$/.test(idempotencyKey))) {
    return NextResponse.json({ error: 'Invalid idempotencyKey' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (!Array.isArray(sections) || !sections.every(isValidSection)) {
    return NextResponse.json({ error: 'Invalid sections' }, { status: 400 });
  }
  if (rejectReasons !== undefined && (!Array.isArray(rejectReasons) || !rejectReasons.every((r) => typeof r === 'string'))) {
    return NextResponse.json({ error: 'Invalid rejectReasons' }, { status: 400 });
  }

  // R7 — contract-required content per status.
  if (status === 'approved' || status === 'needs_editor') {
    if (sections.length === 0 || !judge || typeof judge !== 'object') {
      return NextResponse.json({ error: 'Approved/needs_editor callbacks require sections and judge' }, { status: 400 });
    }
  }
  if (status === 'rejected') {
    if (!Array.isArray(rejectReasons) || rejectReasons.length === 0) {
      return NextResponse.json({ error: 'Rejected callbacks require rejectReasons' }, { status: 400 });
    }
  }

  const existing = await getReadingByReportId(reportId);
  if (!existing) {
    // R2.2 — unknown reportId -> 404 (never create a record from a callback).
    return NextResponse.json({ error: 'Unknown reportId' }, { status: 404 });
  }

  const existingResult = existing.result as Record<string, any>;
  const tier = existingResult.tier === 'paid' ? 'paid' : existingResult.tier === 'free' ? 'free' : null;
  const isR65Report =
    (existingResult.reportType === 'natal' && tier === 'free') ||
    (existingResult.reportType === 'loveblueprint' && tier === 'paid');
  if (isR65Report && (status === 'approved' || status === 'needs_editor')) {
    const artifact = validateQualityRecoveryArtifact(qualityArtifact);
    if (!artifact || !tier || artifact.candidateHash !== hashReportSections(sections)) {
      return NextResponse.json({ error: 'Invalid quality recovery artifact' }, { status: 400 });
    }
    if (status === 'approved' && !qualityArtifactProvesPass(artifact, tier, sections)) {
      return NextResponse.json({ error: 'Approved callback failed automated quality gates' }, { status: 409 });
    }
    // Paid Love Blueprint may be approved only after it first entered the mandatory
    // needs_editor state; direct processing -> approved delivery is forbidden.
    if (status === 'approved' && existingResult.reportType === 'loveblueprint' && currentStatus(existing) !== 'needs_editor') {
      return NextResponse.json({ error: 'Paid report requires explicit editor sign-off' }, { status: 409 });
    }
  }

  // R2.4/R4 — atomic, hash-aware duplicate/conflict handling.
  const callbackHash = canonicalCallbackHash({
    status,
    sections,
    judge: judge ?? null,
    qualityArtifact: qualityArtifact ?? null,
    editorNote: editorNote ?? null,
    rejectReasons: Array.isArray(rejectReasons) ? rejectReasons : [],
  });

  // R2.5 — build the inner pipeline object (NOT nested). applyPipelineCallback
  // writes this directly at result.pipeline.
  const pipelineValue: Record<string, unknown> = {
    status,
    sections,
    judge: judge ?? null,
    qualityArtifact: qualityArtifact ?? null,
    editorNote: editorNote ?? null,
    rejectReasons: Array.isArray(rejectReasons) ? rejectReasons : [],
    completedAt: new Date().toISOString(),
  };

  const outcome = await applyPipelineCallback({
    reportId,
    status: status as PipelineStatus,
    pipelineValue,
    callbackHash,
    idempotencyKey,
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
