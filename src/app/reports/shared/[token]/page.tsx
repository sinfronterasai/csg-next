import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReportType } from '@/lib/reportEngine';
import ReportResult from '@/components/reports/ReportResult';
import { getReadingByShareToken } from '@/lib/profile/store';

export const dynamic = 'force-dynamic';

// Public, read-only view of a shared report. Reached only via the unguessable
// share_token (never the sequential id), so other users' reports stay private.
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const rec = await getReadingByShareToken(token);
  if (!rec || rec.type !== 'report') notFound();

  const result = (rec.result ?? {}) as {
    title?: string; overview?: { glyph?: string; label: string; value: string; note?: string }[];
    sections?: { heading: string; body: string }[]; reportType?: ReportType;
  };

  return (
    <section className="py-24 relative z-10">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Shared Reading</span>
          <p className="text-xs uppercase tracking-[0.3em] text-gold/60">Cosmic Spirit Guide</p>
        </div>
        <ReportResult
          type={result.reportType ?? 'natal'}
          title={result.title ?? rec.title ?? undefined}
          overview={result.overview ?? []}
          sections={result.sections ?? []}
        />
        <div className="text-center mt-10">
          <Link
            href="/reports"
            className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)]"
          >
            Get Your Own Report
          </Link>
        </div>
      </div>
    </section>
  );
}
