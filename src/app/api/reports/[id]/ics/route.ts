import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReadingById, isReportDeliverable } from '@/lib/profile/store';
import { buildYearlyTransitIcs } from '@/lib/yearlyTransit/ics';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get('auth_token')?.value;
  const decoded = token ? verifyToken(token) : null;
  if (!decoded || !(await getUserById(decoded.userId))) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
  const record = await getReadingById(id, Number(decoded.userId));
  const result = record?.result as any;
  if (!record || record.type !== 'report' || result?.reportType !== 'transit' || !isReportDeliverable(record)) return NextResponse.json({ error: 'Yearly transit calendar is not available' }, { status: 404 });
  const pack = result.yearlyTransitPack ?? result.metadata?.yearlyTransitPack;
  if (!pack || typeof result.reportId !== 'string') return NextResponse.json({ error: 'Yearly transit facts incomplete' }, { status: 422 });
  try {
    const ics = buildYearlyTransitIcs(pack, result.reportId);
    return new Response(ics, { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="cosmic-spirit-guide-yearly-transit-${id}.ics"`, 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not generate yearly transit calendar' }, { status: 422 });
  }
}
