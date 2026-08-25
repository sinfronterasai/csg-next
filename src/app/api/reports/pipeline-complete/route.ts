import { NextResponse } from 'next/server';
import { getReadingByReportId, applyPipelineResult, type UniversalReadingRecord } from '@/lib/profile/store';
import { verifyCallbackToken, canTransition } from '@/lib/reportPipeline';

// POST /api/reports/pipeline-complete
// n8n calls this with the generated/approved/rejected report. The app is the
// system of record; we NEVER accept a callback-supplied user id. Ownership is
// resolved from the existing reading row keyed by the app-generated reportId.
//
// Privacy: no birth data, verifiedFacts, bearer values, or full report prose is
// logged here. We only log coarse status transitions.

const VALID_STATUSES = new Set(['approved', 'needs_editor', 'rejected']);

interface CallbackSection { id?: string; prose?: string; factsCited?: string[] }
interface CallbackBody {
  reportId?: string;
  status?: string;
  sections?: CallbackSection[];
  judge?: Record<string, unknown>;
  editorNote?: string;
  rejectReasons?: string[];
}

function currentStatus(rec: UniversalReadingRecord | null): string | null {
  if (!rec) return null;
  const pipeline = (rec.result?.pipeline as { status?: string } | undefined);
  return pipeline?.status ?? rec.pipelineStatus ?? null;
}

export async function POST(request: Request) {
  // R2.1 — reject absent/incorrect callback bearer token.
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyCallbackToken(provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CallbackBody;
  try {
    body = await request.json();
  } catch {
    // R2.3 — malformed callback returns 400.
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const { reportId, status, sections, judge, editorNote, rejectReasons } = body;

  // R2.2 — validate body and known reportId before mutation.
  if (!reportId || typeof reportId !== 'string') {
    return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await getReadingByReportId(reportId);
  if (!existing) {
    // R2.2 — unknown reportId -> 404 (never create a record from a callback).
    return NextResponse.json({ error: 'Unknown reportId' }, { status: 404 });
  }

  const before = currentStatus(existing);
  // R2.4 — prevent terminal-state regression / conflicting duplicate payload.
  if (!canTransition(before, status)) {
    // Identical duplicate callbacks (same terminal status) are harmless -> 200.
    if (before === status) {
      return NextResponse.json({ success: true, status, duplicate: true });
    }
    return NextResponse.json({ error: 'Conflicting duplicate callback' }, { status: 409 });
  }

  // R2.5 — persist approved/edited sections, judge result, reject reasons, status.
  // R2.6 — ownership comes from `existing`; we never read/store callback user ids.
  const resultPatch: Record<string, unknown> = {
    pipeline: {
      status,
      sections: Array.isArray(sections) ? sections : [],
      judge: judge ?? null,
      editorNote: editorNote ?? null,
      rejectReasons: Array.isArray(rejectReasons) ? rejectReasons : [],
      completedAt: new Date().toISOString(),
    },
  };

  const updated = await applyPipelineResult({
    reportId,
    status: status as any,
    resultPatch,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Failed to persist report' }, { status: 500 });
  }

  // Coarse status only — no PII, no facts, no bearer.
  return NextResponse.json({ success: true, status });
}
