'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReportResult from '@/components/reports/ReportResult';

const PRODUCTS = [
  { id: 'transit', name: 'Yearly Transit Forecast', price: '$49', blurb: 'Map planetary movements relative to your life nodes over the next 12 months.', icon: 'fa-clock-rotate-left' },
  { id: 'synastry', name: 'Synastry Love Report', price: '$65', blurb: 'Overlay two charts to unlock structural compatibility, friction zones, and soul-contract links.', icon: 'fa-heart-circle-bolt', needsPartner: true },
  { id: 'vocation', name: 'Vocation and Wealth Map', price: '$55', blurb: 'Decode Midheaven aspects and 2nd/10th House dynamics for perfect professional alignment.', icon: 'fa-briefcase' },
  { id: 'zoom', name: 'Tarot and Astrological Zoom', price: '$120', blurb: 'A live, 60-minute virtual session with a certified cosmic high-priestess addressing career and destiny.', icon: 'fa-wand-magic-sparkles', external: true },
];

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{
    type: string;
    text?: string;
    overview?: { glyph?: string; label: string; value: string; note?: string }[];
    sections?: { heading: string; body: string }[];
    readingId?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partner, setPartner] = useState({ birthDate: '', birthTime: '', location: '' });

  async function generate(id: string) {
    setLoading(id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: id, partner: id === 'synastry' ? partner : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresBirthChart) {
          setError('Create your birth chart first, then return here.');
        } else {
          setError(data.error || 'Generation failed');
        }
        return;
      }
      setResult({
        type: id,
        text: data.text,
        overview: (data as any).overview,
        sections: (data as any).sections,
        readingId: data.readingId,
      });
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="py-24 relative z-10 constellation-map">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Personalized Reports</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Your Celestial Dossiers</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
          <p className="text-gray-300 mt-6 font-light">
            Each report is generated from your saved birth chart by our AI astrologer. Create your chart first, then generate instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-gold/30 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-6">
                  <i className={`fa-solid ${p.icon}`} />
                </div>
                <h3 className="text-xl font-serif text-white mb-2 group-hover:text-gold transition-colors">{p.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{p.blurb}</p>
                {p.needsPartner && (
                  <div className="mt-4 space-y-2">
                    <input
                      placeholder="Partner birth date (YYYY-MM-DD)"
                      value={partner.birthDate}
                      onChange={(e) => setPartner({ ...partner, birthDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    />
                    <input
                      placeholder="Partner time (HH:MM, optional)"
                      value={partner.birthTime}
                      onChange={(e) => setPartner({ ...partner, birthTime: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    />
                    <input
                      placeholder="Partner location (optional)"
                      value={partner.location}
                      onChange={(e) => setPartner({ ...partner, location: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                    />
                  </div>
                )}
              </div>
              <div className="pt-6 border-t border-white/5 flex justify-between items-center mt-6">
                <span className="font-serif text-gold">{p.price}</span>
                {p.external ? (
                  <Link href="/birth-chart" className="text-xs uppercase tracking-wider text-white hover:text-gold font-semibold flex items-center gap-1.5">
                    Book <i className="fa-solid fa-arrow-right text-[10px]" />
                  </Link>
                ) : (
                  <button
                    onClick={() => generate(p.id)}
                    disabled={loading === p.id}
                    className="text-xs uppercase tracking-wider text-white hover:text-gold font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading === p.id ? 'Generating…' : 'Generate'} <i className="fa-solid fa-arrow-right text-[10px]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-10 max-w-2xl mx-auto text-center text-rose-300 glass-panel p-6 rounded-2xl border border-rose-400/20">
            {error}
          </div>
        )}

        {result && (
          result.overview && result.sections ? (
            <div className="mt-10 max-w-3xl mx-auto">
              <ReportResult type={result.type as any} overview={result.overview} sections={result.sections} />
            </div>
          ) : (
          <div className="mt-10 max-w-3xl mx-auto glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20">
            <h3 className="text-2xl font-serif text-gold mb-4 capitalize">{result.type} Report</h3>
            <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap">{result.text}</div>
            {result.readingId && (
              <div className="mt-6 pt-6 border-t border-gold/10 text-center">
                <Link href="/profile?tab=reports" className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
                  View in Library
                </Link>
              </div>
            )}
          </div>
          )
        )}

        <div className="text-center mt-16">
          <Link href="/birth-chart" className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
            Create Your Birth Chart
          </Link>
        </div>
      </div>
    </section>
  );
}
