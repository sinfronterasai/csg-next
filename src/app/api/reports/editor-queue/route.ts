import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { listEditorQueueReports, type UniversalReadingRecord } from '@/lib/profile/store';
import { normalizeSafeReportSections, validateQualityRecoveryArtifact } from '@/lib/reportPipeline';

/** Convert a private DB row to the exact safe editor queue contract. */
function toPrivateEditorQueueItem(reading: UniversalReadingRecord) {
  if (reading.type !== 'report' || reading.pipelineStatus !== 'needs_editor') return null;
  const result = reading.result as Record<string, any>;
  const reportType = result.reportType;
  const tier = result.tier;
  if (!((reportType === 'natal' && tier === 'free') || (reportType === 'loveblueprint' && tier === 'paid'))) return null;
  if (typeof result.reportId !== 'string' || result.reportId.length === 0) return null;
  const pipeline = result.pipeline;
  if (!pipeline || typeof pipeline !== 'object') return null;
  const safeDraftSections = normalizeSafeReportSections(pipeline.sections);
  const qualityArtifact = validateQualityRecoveryArtifact(pipeline.qualityArtifact);
  if (!safeDraftSections || !qualityArtifact) return null;
  return {
    readingId: reading.id,
    reportId: result.reportId,
    reportType,
    tier,
    status: 'needs_editor',
    createdAt: reading.createdAt,
    safeDraftSections,
    qualityArtifact,
  };
}

/** GET /api/reports/editor-queue — private, role-gated R6.5 queue. */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const user = await getUserById(decoded.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    if (user.role !== 'editor' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const rows = await listEditorQueueReports();
    return NextResponse.json({ reports: rows.map(toPrivateEditorQueueItem).filter((r) => r !== null) });
  } catch (err: any) {
    console.error('[editor-queue] failed:', err?.message);
    return NextResponse.json({ error: 'Editor queue unavailable' }, { status: 500 });
  }
}
