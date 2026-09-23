'use client';

// Owner Reports tab. Consumes the public async report contract returned by
// GET /api/profile/reports (toPublicReport): {id, reportId, title, type, status,
// overview, sections:[{id, prose}], createdAt}. It no longer depends on the
// legacy result.text field. Rendering is gated by pipeline status:
//   approved      -> every non-empty section in order, plus a Download PDF action
//   queued/pending-> "being prepared" placeholder, no prose/PDF
//   rejected      -> non-sensitive failure/retry message (no judge data / reasons)
// factsCited, judge internals, callback tokens, and reject reasons are never shown.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { exportReportPdf, downloadPaidNatalPdf, downloadYearlyTransitPdf } from '@/lib/reportPdf';
import {
  asyncReportToPdfInput,
  mapAsyncSectionsToPdf,
  type AsyncPublicReport,
} from '@/lib/reportPdfAdapter';

type PublicReport = AsyncPublicReport;

function TransitApprovedBody({ report }: { report: PublicReport }) {
  const presentation = report.presentation;
  const sections = mapAsyncSectionsToPdf(report.sections);
  if (!presentation) return <ApprovedBody report={report} />;
  const theme = sections.find((section) => /theme|overview/i.test(section.heading));
  const actions = sections.filter((section) => /action|recommend|plan/i.test(section.heading));
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-gold/70 mb-2">Forecast period</p>
        <p className="font-serif text-xl text-cosmic-50">{presentation.periodLabel}</p>
        {theme ? <div className="mt-4 text-cosmic-100 leading-relaxed whitespace-pre-line">{theme.body}</div> : null}
      </section>

      <section>
        <h5 className="font-serif text-2xl text-gold mb-4">Major transit windows</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-gold/20 text-xs uppercase tracking-wider text-gold/70"><th className="py-3 pr-4">Transit</th><th className="py-3 pr-4">Active period</th><th className="py-3">Importance</th></tr></thead>
            <tbody>{presentation.groupedTransits.slice(0, 8).map((transit) => <tr key={transit.id} className="border-b border-white/5"><td className="py-3 pr-4 font-serif text-cosmic-50">{transit.heading}</td><td className="py-3 pr-4 text-cosmic-200">{transit.activePeriod}</td><td className="py-3 text-gold">{transit.importance}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h5 className="font-serif text-2xl text-gold mb-4">Your most important transits</h5>
        <div className="space-y-5">{presentation.groupedTransits.slice(0, 8).map((transit) => <article key={transit.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h6 className="font-serif text-xl text-cosmic-50">{transit.heading}</h6>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-cosmic-200"><span><strong className="text-gold">Importance:</strong> {transit.importance}</span><span><strong className="text-gold">Active:</strong> {transit.activePeriod}</span><span><strong className="text-gold">Life area:</strong> {transit.lifeArea}</span></div>
          {transit.exactHits.length ? <div className="mt-4"><p className="text-xs uppercase tracking-[0.2em] text-gold/70 mb-2">Exact hits</p><ul className="list-disc list-inside text-cosmic-100">{transit.exactHits.map((hit) => <li key={hit}>{hit}</li>)}</ul></div> : null}
          {transit.phases.length ? <div className="mt-4"><p className="text-xs uppercase tracking-[0.2em] text-gold/70 mb-2">How this transit unfolds</p><ul className="space-y-1 text-cosmic-100">{transit.phases.map((phase) => <li key={`${phase.label}-${phase.period}`}><strong className="text-gold">{phase.label}:</strong> {phase.period}</li>)}</ul></div> : null}
        </article>)}</div>
      </section>

      <section>
        <h5 className="font-serif text-2xl text-gold mb-4">Month by month</h5>
        <div className="grid gap-3 sm:grid-cols-2">{presentation.monthly.map((month) => <div key={month.key} className="rounded-xl border border-white/10 p-4"><h6 className="font-serif text-lg text-cosmic-50">{month.label}</h6><p className="mt-1 text-sm text-cosmic-300">{month.summary}</p>{month.transitNames.length ? <p className="mt-2 text-sm text-cosmic-100">{month.transitNames.join('; ')}</p> : <p className="mt-2 text-sm text-cosmic-300">A quieter month for integration and consolidation.</p>}</div>)}</div>
      </section>

      {actions.length ? <section><h5 className="font-serif text-2xl text-gold mb-4">Action plan</h5>{actions.map((section) => <div key={section.heading} className="text-cosmic-100 leading-relaxed whitespace-pre-line">{section.body}</div>)}</section> : null}

      <section><h5 className="font-serif text-2xl text-gold mb-4">Supporting influences</h5><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-gold/20 text-xs uppercase tracking-wider text-gold/70"><th className="py-3 pr-4">Transit</th><th className="py-3 pr-4">Active window</th><th className="py-3">Importance</th></tr></thead><tbody>{presentation.appendix.map((item) => <tr key={item.id} className="border-b border-white/5"><td className="py-3 pr-4 text-cosmic-50">{item.transit}</td><td className="py-3 pr-4 text-cosmic-200">{item.activePeriod}</td><td className="py-3 text-gold">{item.importance}</td></tr>)}</tbody></table></div></section>

      <div className="pt-4 border-t border-gold/10"><button type="button" onClick={() => { if (report.id) void downloadYearlyTransitPdf(report.id); }} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs">Download PDF</button></div>
    </div>
  );
}

function StatusBody({ report, onRetry, retrying }: { report: PublicReport; onRetry: () => void; retrying: boolean }) {
  const status = report.status ?? 'queued';

  if (status === 'dispatch_failed') {
    return (
      <div>
        <p className="text-cosmic-200 leading-relaxed">
          We couldn’t connect to the report service. Your purchase is safe; retrying will not charge you again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry Report'}
        </button>
      </div>
    );
  }

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
      <div>
        <p className="text-cosmic-200 leading-relaxed">
          Your report is receiving a final quality review. We’ll notify you when it’s ready.
        </p>
      </div>
    );
  }

  // queued / pending / processing; unknown legacy states fail closed.
  if (status !== 'queued' && status !== 'pending' && status !== 'processing') {
    return (
      <div>
        <p className="text-cosmic-200 leading-relaxed">
          We couldn’t finish this report to our quality bar. You can retry from the reports page, or contact support and we’ll make it right.
        </p>
        <Link href="/reports" className="mt-4 inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-xs font-semibold hover:opacity-90 transition">Retry Report</Link>
      </div>
    );
  }

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
            onClick={() => {
              if (report.paid && (report.type === 'natal' || report.type === 'natalpremium')) {
                void downloadPaidNatalPdf(report.id);
              } else {
                exportReportPdf(pdfInput);
              }
            }}
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
  const [error, setError] = useState<'load' | 'auth' | 'retry' | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  async function retryReport(report: PublicReport) {
    setRetryingId(report.id);
    try {
      const res = await fetch(`/api/reports/${report.id}/retry`, { method: 'POST' });
      if (!res.ok) {
        setError('retry');
        return;
      }
      setReports((current) => current.map((entry) => entry.id === report.id
        ? { ...entry, status: 'queued', sections: [], overview: [], pending: true }
        : entry));
    } catch {
      setError('retry');
    } finally {
      setRetryingId(null);
    }
  }

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
                {isApproved ? (report.type === 'transit' ? <TransitApprovedBody report={report} /> : <ApprovedBody report={report} />) : <StatusBody report={report} onRetry={() => void retryReport(report)} retrying={retryingId === report.id} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
