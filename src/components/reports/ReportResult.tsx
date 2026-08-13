// Presentational report renderer. Consumes the structured output of the single
// report engine (reportEngine.ts): a Layer-1 `overview` table plus Layer-2
// `sections` rendered as expandable details. No markdown dump. Matches the
// aistro summary-first pattern in the report product design (PART 2).

import type { ReportType, ReportRow, ReportSection } from '@/lib/reportEngine';

const TYPE_LABEL: Record<ReportType, string> = {
  natal: 'Natal Birth Chart Report',
  transit: 'Yearly Transit Forecast',
  synastry: 'Synastry Love Report',
  vocation: 'Vocation and Wealth Map',
};

export default function ReportResult({
  type,
  overview,
  sections,
}: {
  type: ReportType;
  overview: ReportRow[];
  sections: ReportSection[];
}) {
  return (
    <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20">
      <h3 className="text-2xl font-serif text-gold mb-1 capitalize">{TYPE_LABEL[type]}</h3>
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
    </div>
  );
}
