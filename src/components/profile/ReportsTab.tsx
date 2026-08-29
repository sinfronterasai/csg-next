'use client';

// Owner Reports tab. Consumes the public async report contract returned by
// GET /api/profile/reports (toPublicReport): {id, reportId, title, type, status,
// overview, sections:[{id, prose}], createdAt}. It no longer depends on the
// legacy result.text field. Rendering is gated by pipeline status:
//   approved      -> every non-empty section in order, plus a Download PDF action
//   queued/pending-> "being prepared" placeholder, no prose/PDF
//   needs_editor  -> editor-review placeholder, not customer-deliverable, no PDF
//   rejected      -> non-sensitive failure/retry message (no judge data / reasons)
// factsCited, judge internals, callback tokens, and reject reasons are never shown.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { exportReportPdf } from '@/lib/reportPdf';
import {
  asyncReportToPdfInput,
  mapAsyncSectionsToPdf,
  type AsyncPublicReport,
} from '@/lib/reportPdfAdapter';

type PublicReport = AsyncPublicReport;

function StatusBody({ report }: { report: PublicReport }) {
  const status = report.status ?? 'queued';

  if (status === 'rejected') {
    return (
      <div>
        <p className="text-cosmic-200 leading-relaxed">
          We couldn’t finish this report to our quality bar. You can retry from the reports page, or contact support and we’ll make it right.
        </p>
        <Link href="/reports" className="mt-4 inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-xs font-semibold hover:opacity-90 transition">Retry Report</Link>
      </div>
    );
  }

  if (status === 'needs_editor') {
    return (
      <p className="text-cosmic-200 leading-relaxed">
        Your report finished its automated checks and is in final review. We’ll notify you the moment it’s ready.
      </p>
    );
  }

  // queued / pending / unknown
  return (
    <p className="text-cosmic-200 leading-relaxed">
      Your report is being prepared. We’ll notify you when it’s ready.
    </p>
  );
}

function ApprovedBody({ report }: { report: PublicReport }) {
  const pdfInput = asyncReportToPdfInput(report);
  const sections = mapAsyncSectionsToPdf(report.sections);
  return (
    <div>
      <div className="space-y-5">
        {sections.map((s, i) => (
          <div key={`${report.reportId ?? report.id}-sec-${i}`}>
            <h5 className="font-serif text-base font-semibold text-gold mb-1">{s.heading}</h5>
            <div className="prose prose-invert max-w-none text-cosmic-100 leading-relaxed whitespace-pre-line">{s.body}</div>
          </div>
        ))}
      </div>
      {pdfInput && (
        <div className="mt-6 pt-4 border-t border-gold/10">
          <button
            type="button"
            onClick={() => exportReportPdf(pdfInput)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)]"
          >
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReportsTab() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'load' | 'auth' | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function loadReports() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/profile/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      } else if (res.status === 401) {
        setError('auth');
      } else {
        setError('load');
      }
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, []);

  if (loading) return <div className="text-center text-cosmic-300 py-12">Loading…</div>;

  if (error) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-triangle-exclamation text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">Couldn’t Load Reports</h3>
      <p className="text-cosmic-200 mb-6">Something went wrong fetching your reports.</p>
      {error === 'auth' ? (
        <Link href="/login" className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition">Sign In</Link>
      ) : (
        <button onClick={loadReports} className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition">Retry</button>
      )}
    </div>
  );

  if (reports.length === 0) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-file-lines text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">No Reports Yet</h3>
      <p className="text-cosmic-200">Your yearly transits, vocation, and relationship reports will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {reports.map((report) => {
        const isApproved = report.status === 'approved';
        return (
          <div key={report.id} className="glass-panel glow-border rounded-2xl overflow-hidden">
            <button onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gold/5 transition">
              <div>
                <h4 className="font-serif text-lg font-semibold text-gold">{report.title || 'Untitled Report'}</h4>
                <p className="text-sm text-cosmic-300 mt-1">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''}</p>
              </div>
              <i className={`fa-solid fa-chevron-${expanded === report.id ? 'up' : 'down'} text-gold transition-transform`}></i>
            </button>
            {expanded === report.id && (
              <div className="px-6 pb-6 border-t border-gold/20 pt-4">
                {isApproved ? <ApprovedBody report={report} /> : <StatusBody report={report} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
