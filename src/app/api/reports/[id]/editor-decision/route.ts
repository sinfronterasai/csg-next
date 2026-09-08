import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { verifyToken, getUserById } from '@/lib/auth';
import {
  getReportByIdForRole, claimEditorAction, releaseEditorActionClaim,
} from '@/lib/profile/store';
import {
  editorActionIdempotencyKey, normalizeSafeReportSections, qualityArtifactProvesPass,
  sendEditorAction, validateQualityRecoveryArtifact,
  type EditorAction, type EditorActionInput, type SafeReportSection,
} from '@/lib/reportPipeline';

const MAX_BODY_BYTES = 250_000;
const MAX_NOTE_LENGTH = 2_000;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function readBody(request: Request): Promise<{ body?: Record<string, unknown>; error?: NextResponse }> {
  let raw: string;
  try { raw = await request.text(); } catch { return { error: jsonError('Malformed body', 400) }; }
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { error: jsonError('Payload too large', 413) };
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: jsonError('Malformed body', 400) };
    return { body };
  } catch { return { error: jsonError('Malformed JSON', 400) }; }
}

function validNote(value: unknown): string | null {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > MAX_NOTE_LENGTH) return null;
  return value.trim();
}

function requestedAction(value: unknown): EditorAction | null {
  if (value === 'accept') return 'approve';
  return value === 'approve' || value === 'reject' || value === 'resubmit' || value === 'regenerate' ? value : null;
}

function validateTargetIds(ids: unknown, allowed: Set<string>): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) return null;
  if (!ids.every((id) => typeof id === 'string' && id.length >= 1 && id.length <= 120)) return null;
  if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) return null;
  return ids;
}

/** PATCH /api/reports/:id/editor-decision — private R6.5 staff action endpoint. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return jsonError('Authentication required', 401);
    const decoded = verifyToken(token);
    if (!decoded) return jsonError('Authentication required', 401);
    const user = await getUserById(decoded.userId);
    if (!user) return jsonError('User not found', 401);
    if (user.role !== 'editor' && user.role !== 'admin') return jsonError('Forbidden', 403);

    const { id } = await params;
    if (!/^\d+$/.test(id) || Number(id) <= 0 || !Number.isSafeInteger(Number(id))) return jsonError('Invalid report id', 400);
    const readingId = Number(id);
    const reading = await getReportByIdForRole(readingId);
    if (!reading) return jsonError('Report not found', 404);
    if (reading.pipelineStatus !== 'needs_editor') {
      return NextResponse.json({ error: 'Report is not awaiting an editor decision', status: reading.pipelineStatus }, { status: 409 });
    }

    const result = reading.result as Record<string, any>;
    const reportType = result.reportType;
    const tier = result.tier;
    if (!((reportType === 'natal' && tier === 'free') || (reportType === 'loveblueprint' && tier === 'paid'))) {
      return jsonError('Report is outside the R6.5 editor scope', 400);
    }
    if (typeof result.reportId !== 'string' || result.reportId.length === 0) return jsonError('Missing report correlation', 409);

    const parsed = await readBody(request);
    if (parsed.error) return parsed.error;
    const body = parsed.body!;
    const action = requestedAction(body.action ?? body.decision);
    if (!action) return jsonError("action must be 'approve', 'reject', 'resubmit', or 'regenerate'", 400);
    const editorNote = validNote(body.editorNote);
    if (editorNote === null) return jsonError('Invalid editorNote', 400);
    if (action === 'reject' && editorNote.length === 0) return jsonError('Reject requires an internal reason', 400);

    const pipeline = result.pipeline;
    if (!pipeline || typeof pipeline !== 'object') return jsonError('Missing stored quality artifact', 409);
    const currentSections = normalizeSafeReportSections(pipeline.sections);
    const qualityArtifact = validateQualityRecoveryArtifact(pipeline.qualityArtifact);
    if (!currentSections || !qualityArtifact) return jsonError('Stored quality artifact is invalid', 409);
    const verifiedFacts = result.metadata?.verifiedFacts;
    if (!verifiedFacts || typeof verifiedFacts !== 'object' || Array.isArray(verifiedFacts)) {
      return jsonError('Missing authoritative fact package', 409);
    }

    let correctedSections: SafeReportSection[] = [];
    let regenerateSectionIds: string[] = [];
    if (action === 'approve') {
      if (!qualityArtifactProvesPass(qualityArtifact, tier, currentSections)) {
        return jsonError('Automated quality gates have not produced a validated pass', 409);
      }
    } else if (action === 'resubmit') {
      if (body.regenerateSectionIds !== undefined) return jsonError('Choose corrected sections or regeneration, not both', 400);
      const normalized = normalizeSafeReportSections(body.correctedSections);
      const failed = new Set(qualityArtifact.failedSections);
      if (
        !normalized || normalized.length !== failed.size ||
        normalized.some((s) => !failed.has(s.id)) ||
        [...failed].some((id) => !normalized.some((s) => s.id === id))
      ) {
        return jsonError('Corrected sections must exactly match all failed section IDs', 400);
      }
      correctedSections = normalized;
    } else if (action === 'regenerate') {
      if (body.correctedSections !== undefined) return jsonError('Choose corrected sections or regeneration, not both', 400);
      const repairable = new Set(qualityArtifact.issues.filter((i) => i.repairable).map((i) => i.section));
      const ids = validateTargetIds(body.regenerateSectionIds, repairable);
      if (!ids) return jsonError('Regeneration IDs must be unique failed repairable sections', 400);
      regenerateSectionIds = ids;
    }

    const input: EditorActionInput = {
      reportId: result.reportId,
      reportType,
      tier,
      action,
      reviewer: user.email ?? String(user.id),
      editorNote,
      currentSections,
      correctedSections,
      regenerateSectionIds,
      qualityArtifact,
      verifiedFacts,
    };
    const idempotencyKey = editorActionIdempotencyKey(input);
    const actionHash = crypto.createHash('sha256').update(JSON.stringify({ idempotencyKey, action })).digest('hex');
    const claim = await claimEditorAction(readingId, actionHash, idempotencyKey);
    if (claim === 'duplicate') {
      return NextResponse.json({ success: true, action, status: 'accepted', duplicate: true }, { status: 202 });
    }
    if (claim === 'conflict') return jsonError('A different editor action is already in progress', 409);
    if (claim === 'invalid_state') return jsonError('Report is not awaiting an editor decision', 409);
    if (claim === 'not_found') return jsonError('Report not found', 404);

    try {
      const response = await sendEditorAction(input);
      if (!response.ok) throw new Error(`editor webhook rejected with status ${response.status}`);
    } catch (err: any) {
      await releaseEditorActionClaim(readingId, actionHash);
      // Never log prose, facts, request bodies, or credentials.
      console.error('[editor-decision] private dispatch failed:', err?.message);
      return jsonError('Editor dispatch failed. Please retry.', 502);
    }
    return NextResponse.json({ success: true, action, status: 'accepted' }, { status: 202 });
  } catch (err: any) {
    console.error('[editor-decision] failed:', err?.message);
    return jsonError('Editor action failed', 500);
  }
}
