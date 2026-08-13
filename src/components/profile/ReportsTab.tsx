'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Report {
  id: number;
  title: string | null;
  createdAt: string;
  result: { text?: string };
  pricePaid: number | null;
}

export default function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
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
      {reports.map((report) => (
        <div key={report.id} className="glass-panel glow-border rounded-2xl overflow-hidden">
          <button onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gold/5 transition">
            <div>
              <h4 className="font-serif text-lg font-semibold text-gold">{report.title || 'Untitled Report'}</h4>
              <p className="text-sm text-cosmic-300 mt-1">{new Date(report.createdAt).toLocaleDateString()}</p>
            </div>
            <i className={`fa-solid fa-chevron-${expanded === report.id ? 'up' : 'down'} text-gold transition-transform`}></i>
          </button>
          {expanded === report.id && (
            <div className="px-6 pb-6 border-t border-gold/20 pt-4">
              {report.result.text && <div className="prose prose-invert max-w-none text-cosmic-100 leading-relaxed whitespace-pre-line">{report.result.text}</div>}
              {report.pricePaid != null && <p className="mt-4 text-sm text-cosmic-300"><i className="fa-solid fa-tag mr-2"></i>${report.pricePaid.toFixed(2)}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
