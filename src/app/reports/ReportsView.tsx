'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReportResult from '@/components/reports/ReportResult';

// Launch allowlist (C7): the public reports surface exposes ONLY the authorized
// launch slice. Free Natal is available to everyone. Love Blueprint is invite-only
// during beta (the server gate enforces the beta allowlist; this UI never shows a
// price or an unlock CTA for it). Every other report/bundle/tarot spread is hidden
// from the public UI until it is part of an approved launch. The server generation
// route independently rejects any non-launch type (gateGeneration), so hiding here
// is defense-in-depth, not the enforcement boundary.

type Accent = 'teal' | 'gold';
type Kind = 'free' | 'invite';

const ALLOWED: {
  id: string; name: string; blurb: string; icon: string; accent: Accent; cta: string; kind: Kind;
}[] = [
  {
    id: 'natal', name: 'Birth Chart Report', blurb: 'Your complete natal map — the foundation every other report builds on. Start here.',
    icon: 'fa-sun', accent: 'teal', cta: 'START FREE', kind: 'free',
  },
  {
    id: 'loveblueprint', name: 'Love Blueprint', blurb: 'Your Venus, Mars and Moon signature with the real love aspects colouring your chart. Available by invite during the private beta.',
    icon: 'fa-heart', accent: 'gold', cta: 'REQUEST INVITE', kind: 'invite',
  },
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

  async function generate(id: string) {
    setLoading(id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: id, partner: (id === 'synastry' || id === 'composite' || id === 'couples') ? partner : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresBirthChart) {
          setError('Create your birth chart first, then return here.');
        } else if (res.status === 403) {
          setError('Love Blueprint is invite-only during the private beta.');
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
      <section className="pt-36 pb-16 relative constellation-map">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-4">Astrology Reports</span>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight">Your Sky, Decoded Into a Report</h1>
          <p className="text-cosmic-200 mt-6 font-light text-lg max-w-2xl mx-auto">
            Start with your free birth chart. Additional reports open as they are released.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="#gateway" className="px-8 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
              Start Free Birth Chart
            </a>
          </div>
        </div>
      </section>

      <section id="gateway" className="max-w-7xl mx-auto px-6 lg:px-16 -mt-4">
        <div className="glass-panel p-8 md:p-10 rounded-[40px] border border-[#2DD4BF]/40 flex flex-col md:flex-row items-center justify-between gap-6" style={{ boxShadow: '0 0 40px rgba(45,212,191,0.08)' }}>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#2DD4BF]/10 flex items-center justify-center text-[#2DD4BF] text-2xl">
              <i className="fa-solid fa-sun" />
            </div>
            <div>
              <p className="text-[#2DD4BF] text-xs uppercase tracking-[0.3em] font-semibold">Start Here · Free</p>
              <h3 className="font-serif text-2xl text-white mt-1">Your Birth Chart Report</h3>
              <p className="text-cosmic-200 text-sm mt-1">Every other report builds on this. Enter your birth data once — start free.</p>
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

      <section className="max-w-7xl mx-auto px-6 lg:px-16 pt-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Launch Reports</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">Available Now</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALLOWED.map((p) => (
            <div key={p.id} className={`glass-panel p-7 rounded-[32px] border flex flex-col justify-between group hover:border-gold/60 transition-all duration-300 ${p.kind === 'free' ? 'border-[#2DD4BF]/30' : 'border-gold/30'}`}>
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${p.kind === 'free' ? 'bg-[#2DD4BF]/10 text-[#2DD4BF]' : 'bg-gold/10 text-gold'}`}>
                    <i className={`fa-solid ${p.icon}`} />
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest rounded-full px-2.5 py-1 ${p.kind === 'free' ? 'text-[#2DD4BF] border border-[#2DD4BF]/40' : 'text-gold border border-gold/40'}`}>
                    {p.kind === 'free' ? 'Free' : 'Invite only'}
                  </span>
                </div>
                <h3 className="font-serif text-2xl text-white mb-2">{p.name}</h3>
                <p className="text-cosmic-200 text-sm leading-relaxed mb-5">{p.blurb}</p>
              </div>
              <div className="pt-5 border-t border-white/5">
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

      <section className="max-w-4xl mx-auto px-6 pt-16">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
          <i className="fa-solid fa-shield-halved text-gold text-xl mb-3" />
          <p className="text-cosmic-100 text-sm">Your birth metrics are sacred. We reuse your saved chart so you never re-enter them, and your data isn’t sold or shared.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-24">
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
