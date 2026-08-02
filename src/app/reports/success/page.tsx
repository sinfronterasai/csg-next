'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getPremiumReportById } from '@/lib/pricing';

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const reportId = params.get('report');
  const report = reportId ? getPremiumReportById(reportId) : undefined;

  return (
    <section className="py-24 relative z-10 constellation-map">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center text-gold text-2xl mx-auto mb-8">
          <i className="fa-solid fa-check" />
        </div>
        <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Payment Received</span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Thank you — your report is being generated
        </h1>
        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>

        {report && (
          <p className="text-gray-300 mt-8 font-light">
            <span className="text-white font-medium">{report.name}</span> is queued. We will email you
            as soon as it is ready.
          </p>
        )}
        {!report && (
          <p className="text-gray-300 mt-8 font-light">
            Your order is confirmed. We will email you as soon as your report is ready.
          </p>
        )}

        {sessionId && (
          <p className="text-gray-500 text-xs mt-6 break-all">
            Reference: {sessionId}
          </p>
        )}

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/reports"
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)]"
          >
            Back to Reports
          </Link>
          <Link
            href="/my-chart"
            className="inline-flex items-center justify-center px-8 py-4 border border-white/10 text-white font-bold tracking-widest rounded-full uppercase text-xs hover:border-gold/40 transition-all duration-300"
          >
            View My Chart
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function ReportSuccessPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-gray-400">Loading…</div>}>
      <SuccessContent />
    </Suspense>
  );
}
