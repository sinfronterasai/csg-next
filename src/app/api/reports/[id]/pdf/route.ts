import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { getReadingById } from '@/lib/profile/store';
import { buildPaidNatalPdf, type PaidNatalPdfInput } from '@/lib/paidNatalPdf';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    const decoded = token ? verifyToken(token) : null;
    if (!decoded || !(await getUserById(decoded.userId))) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    const record = await getReadingById(id, Number(decoded.userId));
    const result = record?.result as any;
    const status = result?.pipeline?.status ?? record?.pipelineStatus;
    if (!record || record.type !== 'report' || record.pricePaid == null || record.pricePaid <= 0 || result?.reportType !== 'natal' || status !== 'approved') {
      return NextResponse.json({ error: 'Paid natal report is not available' }, { status: 404 });
    }
    const metadata = result.metadata;
    const birth = metadata?.birthData;
    const facts = metadata?.verifiedFacts?.facts;
    const sections = result.pipeline?.sections;
    if (!birth || !facts || !Array.isArray(sections)) return NextResponse.json({ error: 'Report facts incomplete' }, { status: 422 });
    const input: PaidNatalPdfInput = {
      title: result.title || record.title || 'Natal Birth Chart Report',
      name: String(birth.firstName || 'Seeker'),
      birth: { date: String(birth.dob), time: String(birth.birthTime || ''), location: String(birth.place) },
      facts,
      sections: sections.map((s: any) => ({ heading: String(s.id || 'Section'), body: String(s.prose || '') })),
    };
    const pdf = buildPaidNatalPdf(input);
    return new Response(pdf as BodyInit, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cosmic-spirit-guide-natal-${id}.pdf"`, 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not generate report PDF' }, { status: 500 });
  }
}
