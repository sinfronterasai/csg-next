'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReportResult from '@/components/reports/ReportResult';

// Layer-1 "what's inside" bullets are presentation copy that mirrors what the
// deterministic engine actually computes (no fabricated data claims).
const PRODUCTS = [
  {
    id: 'natal',
    name: 'Birth Chart Report',
    price: 'FREE',
    priceNote: 'free gateway',
    blurb: 'Your complete natal map — the foundation every other report builds on. Start here.',
    icon: 'fa-sun',
    accent: 'teal' as const,
    bullets: ['Sun, Moon & Ascendant decode', 'All 10 planets across the 12 houses', 'Your dominant element & modality'],
    cta: 'START FREE',
    kind: 'free' as const,
  },
  {
    id: 'transit',
    name: 'Yearly Transit Forecast',
    price: '$49',
    priceNote: 'one-time',
    blurb: 'Map planetary movements relative to your life nodes over the next 12 months.',
    icon: 'fa-clock-rotate-left',
    accent: 'gold' as const,
    bullets: ['12-month forward ephemeris', 'Career, love, money & health themes', 'Exact timing windows per topic'],
    cta: 'UNLOCK $49',
    kind: 'paid' as const,
  },
  {
    id: 'synastry',
    name: 'Synastry Love Report',
    price: '$65',
    priceNote: 'one-time',
    blurb: 'Overlay two charts to unlock structural compatibility, friction zones, and soul-contract links.',
    icon: 'fa-heart-circle-bolt',
    accent: 'gold' as const,
    bullets: ['Two-chart overlay & aspects', 'Harmony vs friction zones', 'Soul-contract & growth links'],
    cta: 'UNLOCK $65',
    kind: 'paid' as const,
    needsPartner: true,
  },
  {
    id: 'vocation',
    name: 'Vocation & Wealth Map',
    price: '$55',
    priceNote: 'one-time',
    blurb: 'Decode Midheaven aspects and 2nd/10th House dynamics for perfect professional alignment.',
    icon: 'fa-briefcase',
    accent: 'gold' as const,
    bullets: ['2nd, 6th & 10th house reads', 'Midheaven career signature', 'Saturn & Jupiter wealth cues'],
    cta: 'UNLOCK $55',
    kind: 'paid' as const,
  },
];

const TAROT = [
  { name: 'One Card', price: 'FREE', note: 'daily guidance' },
  { name: 'Past · Present · Future', price: 'FREE', note: 'the arc of now' },
  { name: 'Celtic Cross', price: '$4.99', note: 'deep 10-card spread' },
  { name: 'Relationship Dynamics', price: '$4.99', note: 'two-person read' },
  { name: 'Career Crossroads', price: '$4.99', note: 'purpose & path' },
];

const FAQ = [
  { q: 'Do I need my exact birth time?', a: 'It gives the most precise chart (accurate houses & Ascendant). If you don’t know it, you can still generate using solar-house approximation — your Sun, Moon and planet signs stay exact.' },
  { q: 'Is this a subscription?', a: 'No. Each astrology report is a one-time purchase. Tarot spreads are pay-per-spread from $4.99. Nothing recurs unless you choose it.' },
  { q: 'How fast is delivery?', a: 'Reports are computed instantly from your saved birth chart and ready to view, download as PDF, and share the moment they’re generated.' },
  { q: 'Can I re-download later?', a: 'Yes. Every report you generate is saved to your profile library and can be opened or exported to PDF whenever you like.' },
  { q: 'What if I already saved my chart?', a: 'Perfect — every report reuses your saved natal chart, so you’re never asked for your birth details twice.' },
];

export default function Reports() {
  const [loading, setLoading] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{
    type: string;
    text?: string;
    title?: string;
    overview?: { glyph?: string; label: string; value: string; note?: string }[];
    sections?: { heading: string; body: string }[];
    readingId?: number;
    shareUrl?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partner, setPartner] = useState({ birthDate: '', birthTime: '', location: '' });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
        title: (data as any).title,
        text: data.text,
        overview: (data as any).overview,
        sections: (data as any).sections,
        readingId: data.readingId,
        shareUrl: data.shareUrl ?? null,
      });
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setLoading(null);
    }
  }

  async function shareReport(readingId: number) {
    try {
      const res = await fetch(`/api/reports/${readingId}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.shareToken) {
        setError('Could not create a share link. Make sure you are signed in.');
        return;
      }
      const url = `${window.location.origin}/reports/shared/${data.shareToken}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    } catch {
      setError('Could not create a share link.');
    }
  }

  return (
    <div className="relative z-10">
      {/* A. HERO */}
      <section className="pt-36 pb-16 relative constellation-map">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-4">Astrology Reports & Readings</span>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">Your Sky, Decoded Into a Report</h1>
          <p className="text-cosmic-200 mt-6 font-light text-lg max-w-2xl mx-auto">
            From your free birth chart to deep-dive forecasts — own the reading, saved to your chart, delivered to your inbox.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="#gateway" className="px-8 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
              Start Free Birth Chart
            </a>
            <a href="#paid" className="px-8 py-3 rounded-full border border-gold text-gold font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:bg-gold/10">
              Browse Reports
            </a>
          </div>
        </div>
      </section>

      {/* B. START HERE GATEWAY BAND */}
      <section id="gateway" className="max-w-7xl mx-auto px-6 lg:px-16 -mt-4">
        <div className="glass-panel p-8 md:p-10 rounded-[40px] border border-[#2DD4BF]/40 flex flex-col md:flex-row items-center justify-between gap-6" style={{ boxShadow: '0 0 40px rgba(45,212,191,0.08)' }}>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#2DD4BF]/10 flex items-center justify-center text-[#2DD4BF] text-2xl">
              <i className="fa-solid fa-sun" />
            </div>
            <div>
              <p className="text-[#2DD4BF] text-xs uppercase tracking-[0.3em] font-semibold">Start Here · Free</p>
              <h3 className="font-serif text-2xl text-white mt-1">Your Birth Chart Report</h3>
              <p className="text-cosmic-200 text-sm mt-1">Every paid report builds on this. Enter your birth data once — start free.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => generate('natal')}
              disabled={loading === 'natal'}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] disabled:opacity-50"
            >
              {loading === 'natal' ? 'Generating…' : 'Start Free'}
            </button>
          </div>
        </div>
      </section>

      {/* C. PAID ASTRO REPORT GRID */}
      <section id="paid" className="max-w-7xl mx-auto px-6 lg:px-16 pt-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Premium Astrology</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">Deep-Dive Reports</h2>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-[#2DD4BF] border border-[#2DD4BF]/40 rounded-full px-3 py-1.5">
            <i className="fa-solid fa-bolt" /> Instant PDF
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.filter((p) => p.kind === 'paid').map((p) => (
            <div key={p.id} className="glass-panel p-7 rounded-[32px] border border-gold/30 flex flex-col justify-between group hover:border-gold/60 transition-all duration-300">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-xl">
                    <i className={`fa-solid ${p.icon}`} />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#2DD4BF] border border-[#2DD4BF]/40 rounded-full px-2.5 py-1">Instant PDF</span>
                </div>
                <h3 className="font-serif text-2xl text-white mb-2">{p.name}</h3>
                <p className="text-cosmic-200 text-sm leading-relaxed mb-5">{p.blurb}</p>
                <ul className="space-y-2 mb-6">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-cosmic-100">
                      <i className="fa-solid fa-circle text-gold/60 text-[8px] mt-2" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {p.needsPartner && (
                  <div className="mb-5 space-y-2">
                    <input placeholder="Partner birth date (YYYY-MM-DD)" value={partner.birthDate} onChange={(e) => setPartner({ ...partner, birthDate: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
                    <input placeholder="Partner time (HH:MM, optional)" value={partner.birthTime} onChange={(e) => setPartner({ ...partner, birthTime: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
                    <input placeholder="Partner location (optional)" value={partner.location} onChange={(e) => setPartner({ ...partner, location: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
                  </div>
                )}
              </div>
              <div className="pt-5 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-serif text-gold text-lg">{p.price}</span>
                  <span className="text-xs uppercase tracking-widest text-gray-400">{p.priceNote}</span>
                </div>
                <button
                  onClick={() => generate(p.id)}
                  disabled={loading === p.id}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] disabled:opacity-50"
                >
                  {loading === p.id ? 'Generating…' : p.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* D. TAROT SPREADS ROW */}
      <section className="max-w-7xl mx-auto px-6 lg:px-16 pt-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Tarot</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">Tarot Spreads</h2>
            <p className="text-cosmic-200 mt-2 text-sm">Pay per spread — no subscription. From $4.99.</p>
          </div>
          <Link href="/tarot" className="text-xs uppercase tracking-widest text-gold hover:text-white font-semibold hidden sm:inline-flex items-center gap-1.5">
            Open Tarot <i className="fa-solid fa-arrow-right text-[10px]" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {TAROT.map((t) => (
            <Link key={t.name} href="/tarot" className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-gold/30 transition-all duration-300 text-center group">
              <i className="fa-solid fa-cards-blank text-gold/70 text-xl mb-3 group-hover:text-gold transition-colors" />
              <p className="text-white text-sm font-serif">{t.name}</p>
              <p className="text-[#2DD4BF] text-xs mt-1">{t.price}</p>
              <p className="text-gray-500 text-[11px] mt-0.5">{t.note}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* E. LIVE SESSION CARD */}
      <section className="max-w-7xl mx-auto px-6 lg:px-16 pt-16">
        <div className="glass-panel p-8 md:p-10 rounded-[40px] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gold text-2xl">
              <i className="fa-solid fa-user-astronaut" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400 border border-white/10 rounded-full px-2.5 py-1">Human Session</span>
              <h3 className="font-serif text-2xl text-white mt-2">Book a Live Zoom</h3>
              <p className="text-cosmic-200 text-sm mt-1">A 60-minute virtual session with a certified cosmic guide on career & destiny.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-gold text-xl">$120</p>
            <Link href="/birth-chart" className="inline-flex mt-3 px-6 py-3 rounded-full border border-gold text-gold font-bold tracking-widest uppercase text-xs hover:bg-gold/10 transition-all duration-300">
              Book Live
            </Link>
          </div>
        </div>
      </section>

      {/* F. BUNDLE STRIP */}
      <section className="max-w-7xl mx-auto px-6 lg:px-16 pt-16">
        <div className="relative overflow-hidden glass-panel p-8 md:p-10 rounded-[40px] border border-gold/30 text-center" style={{ background: 'linear-gradient(120deg, rgba(138,43,226,0.12), rgba(223,183,108,0.10))' }}>
          <p className="text-xs uppercase tracking-[0.3em] text-gold font-semibold">Best Value</p>
          <h3 className="font-serif text-3xl text-white mt-2">The Full Cosmic Profile</h3>
          <p className="text-cosmic-200 mt-3 max-w-2xl mx-auto text-sm">
            Birth Chart Report (free) + Yearly Transit + Synastry + Vocation. Everything in one place — save $75 vs buying separately.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <span className="font-serif text-2xl text-gold">$149</span>
            <span className="text-gray-400 text-sm line-through">$224 separately</span>
            <button className="px-7 py-3 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)]">
              Get the Bundle $149
            </button>
          </div>
        </div>
      </section>

      {/* G. HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-16 pt-20">
        <h2 className="font-serif text-3xl font-bold text-white text-center mb-10">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { n: '01', t: 'Enter birth data once', d: 'Save your natal chart. It becomes the single source of truth for every report.' },
            { n: '02', t: 'Pick your report', d: 'From the free Birth Chart Report to deep-dive forecasts — choose what speaks to you.' },
            { n: '03', t: 'Instant & ownable', d: 'Generated in seconds: view it, download the PDF, and it’s saved to your library.' },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="font-serif text-5xl text-gold/30 mb-3">{s.n}</div>
              <h4 className="font-serif text-xl text-white mb-2">{s.t}</h4>
              <p className="text-cosmic-200 text-sm max-w-xs mx-auto">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* H. PRIVACY STRIP */}
      <section className="max-w-4xl mx-auto px-6 pt-16">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
          <i className="fa-solid fa-shield-halved text-gold text-xl mb-3" />
          <p className="text-cosmic-100 text-sm">Your birth metrics are sacred. We reuse your saved chart so you never re-enter them, and your data isn’t sold or shared.</p>
        </div>
      </section>

      {/* I. FAQ ACCORDION */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <h2 className="font-serif text-3xl font-bold text-white text-center mb-10">Questions</h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={f.q} className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left text-white font-serif text-lg"
              >
                <span>{f.q}</span>
                <span className={`text-gold/60 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-cosmic-200 text-sm leading-relaxed">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* RESULT (generated report) */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        {error && (
          <div className="text-center text-rose-300 glass-panel p-6 rounded-2xl border border-rose-400/20">
            {error}
          </div>
        )}

        {result && (
          result.overview && result.sections ? (
            <ReportResult
              type={result.type as any}
              title={result.title}
              overview={result.overview!}
              sections={result.sections!}
              readingId={result.readingId}
              shareUrl={shareUrl ?? undefined}
              onShare={result.readingId ? () => shareReport(result.readingId!) : undefined}
            />
          ) : (
            <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20">
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
      </section>
    </div>
  );
}
