// Presentational report renderer. Consumes the structured output of the single
// report engine (reportEngine.ts): a Layer-1 `overview` table plus Layer-2
// `sections` rendered as expandable details. No markdown dump. Matches the
// aistro summary-first pattern in the report product design (PART 2).

import { useState } from 'react';
import type { ReportType, ReportRow, ReportSection } from '@/lib/reportEngine';
import { exportReportPdf } from '@/lib/reportPdf';

export default function ReportResult({
  type,
  title,
  overview,
  sections,
  shareUrl,
}: {
  type: ReportType;
  title?: string;
  overview: ReportRow[];
  sections: ReportSection[];
  shareUrl?: string;
}) {
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied'>('idle');

  const handleShare = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.origin + '/reports' : 'https://cosmicspiritguide.com/reports');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: title || 'Cosmic Spirit Guide Report', url });
        setShareState('shared');
      } catch {
        /* user cancelled */
      }
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    }
  };

  const heading = title || (type ? ({ natal: 'Natal Birth Chart Report', transit: 'Yearly Transit Forecast', synastry: 'Synastry Love Report', vocation: 'Vocation and Wealth Map' } as Record<ReportType, string>)[type] : 'Report');
  return (
    <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20">
      <h3 className="text-2xl font-serif text-gold mb-1 capitalize">{heading}</h3>
      <p className="text-xs uppercase tracking-[0.3em] text-gold/60 mb-6">Your Celestial Dossier</p>

      {/* Layer 1: overview table — always visible */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gold/70 text-xs uppercase tracking-wider border-b border-white/10">
              <th className="py-2 pr-4">Point</th>
              <th className="py-2 pr-4">Position</th>
              <th className="py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {overview.map((r, i) => (
              <tr key={`${r.label}-${i}`} className="border-b border-white/5 text-gray-200">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {r.glyph ? <span className="mr-1 text-gold">{r.glyph}</span> : null}
                  {r.label}
                </td>
                <td className="py-2 pr-4 text-gray-300">{r.value}</td>
                <td className="py-2 text-gray-400 text-sm">{r.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Layer 2: expandable detail sections */}
      <div className="mt-6 space-y-3">
        {sections.map((s, i) => (
          <details
            key={`${s.heading}-${i}`}
            className="group rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
          >
            <summary className="cursor-pointer select-none px-5 py-4 text-gold font-serif text-lg list-none flex items-center justify-between">
              <span>{s.heading}</span>
              <span className="text-gold/50 text-sm group-open:rotate-45 transition-transform">+</span>
            </summary>
            <div className="px-5 pb-5 text-gray-200 leading-relaxed prose-invert max-w-none">
              {s.body}
            </div>
          </details>
        ))}
      </div>

      {/* Action row: PDF + Share (design PART 3 #4) */}
      <div className="mt-6 pt-6 border-t border-gold/10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => exportReportPdf({ type, title: heading, overview, sections })}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)]"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="px-5 py-2.5 rounded-full border border-gold/40 text-gold font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:bg-gold/10"
        >
          {shareState === 'copied' ? 'Link Copied' : shareState === 'shared' ? 'Shared' : 'Share'}
        </button>
      </div>
    </div>
  );
}
