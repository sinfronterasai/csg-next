'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import ReportResult from '@/components/reports/ReportResult';

// Launch allowlist (C7): the public reports surface exposes ONLY the authorized
// launch slice. Free Natal is available to everyone. Love Blueprint is a paid
// product available to all authenticated users (the server gate enforces
// authentication + payment/purchase entitlement; this UI calls the checkout
// endpoint rather than attempting generation directly). Every other report/bundle/
// tarot spread is hidden from the public UI until it is part of an approved
// launch. The server generation route independently rejects any non-launch type
// (gateGeneration), so hiding here is defense-in-depth, not the enforcement boundary.

type Accent = 'teal' | 'gold';
type Kind = 'free' | 'paid';

const ALLOWED: {
  id: string; name: string; blurb: string; icon: string; accent: Accent; cta: string; kind: Kind;
}[] = [
  {
    id: 'natal', name: 'Birth Chart Report', blurb: 'Your complete natal map — the foundation every other report builds on. Start here.',
    icon: 'fa-sun', accent: 'teal', cta: 'START FREE', kind: 'free',
  },
  {
    id: 'loveblueprint', name: 'Love Blueprint', blurb: 'Your Venus, Mars and Moon signature with the real love aspects colouring your chart. $39 — one-time purchase, yours forever.',
    icon: 'fa-heart', accent: 'gold', cta: 'BUY NOW — $39', kind: 'paid',
  },
];

export default function Reports() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  // Resume flow state: track whether we are waiting on a post-checkout entitlement
  // to settle so the UI can show an honest "being prepared" message instead of an
  // empty dossier with PDF/share actions.
  const [resumeState, setResumeState] = useState<'idle' | 'checking' | 'pending' | 'ready' | 'failed'>('idle');
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);

  async function generate(id: string, purchaseId?: string) {
    setLoading(id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: id, partner: (id === 'synastry' || id === 'composite' || id === 'couples') ? partner : undefined, purchaseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresBirthChart) {
          setError('Create your birth chart first, then return here.');
        } else if (data.requiresPurchase) {
          // Payment-required: do NOT generate; return the entitlement error so the
          // UI can tell the buyer to complete checkout rather than spinning forever.
          setError(data.error || 'A purchase is required to generate this report.');
          setResumeState('failed');
        } else {
          setError(data.error || 'Generation failed');
          setResumeState('failed');
        }
        return;
      }
      // #7 — pending-result gate: a queued/processing pipeline response is NOT a
      // ready dossier. Do NOT render the empty overview/sections + PDF/share actions
      // while the report is still in flight. Show an honest "being prepared" state
      // and keep the purchase correlation so a retry can re-attach without re-charging.
      if (data.pending === true || data.status === 'queued' || data.status === 'processing') {
        setResumeState('pending');
        setResumeMessage(data.message || 'Your report is being prepared by our astrology engine. It will be ready shortly.');
        // Keep result null so ReportResult is never rendered with empty data.
        setResult(null);
        return;
      }
      // ready/repeat with real content
      setResumeState('ready');
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
      setResumeState('failed');
    } finally {
      setLoading(null);
    }
  }

  async function startCheckout(id: string) {
    setCheckoutLoading(id);
    setError(null);
    setResumeState('idle');
    setResumeMessage(null);
    try {
      const res = await fetch('/api/billing/checkout-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        setError(data.error || 'Checkout failed');
        setResumeState('failed');
        setResumeMessage('Checkout could not be started. Please try again.');
        return;
      }
      // Stripe Checkout hosts the payment page — redirect the browser there.
      if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyPurchased) {
        // Buyer already owns this report: do NOT start a second checkout. Resume
        // the owned entitlement directly so they can generate without a new charge.
        setResumeState('checking');
        setResumeMessage('Continuing your owned Love Blueprint…');
        await generate(id, data.purchaseId);
      } else {
        setError('Could not start checkout. Please try again.');
        setResumeState('failed');
      }
    } catch (e: any) {
      setError(e?.message || 'Checkout failed');
      setResumeState('failed');
    } finally {
      setCheckoutLoading(null);
    }
  }

  // Post-checkout resume: when Stripe redirects back to /reports?purchase=success,
  // parse the session id from the URL and verify entitlement server-side before
  // generating. Do NOT trust client-supplied purchase id — the resume route
  // recomputes ownership + paid status from the Stripe session.
  useEffect(() => {
    const purchase = searchParams.get('purchase');
    const sessionId = searchParams.get('sessionId');
    if (purchase === 'success' && sessionId) {
      // Defer to the browser paint so the redirect feels instant; then verify.
      const timer = setTimeout(async () => {
        setResumeState('checking');
        setResumeMessage('Verifying your purchase…');
        try {
          const res = await fetch('/api/billing/checkout/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          const data = await res.json();
          if (!res.ok) {
            if (res.status === 401) {
              window.location.href = '/login';
              return;
            }
            if (res.status === 402) {
              setResumeState('failed');
              setResumeMessage('Your purchase has not been confirmed yet. Please wait a moment and return, or contact support if this persists.');
              return;
            }
            if (res.status === 403 || res.status === 404) {
              setResumeState('failed');
              setResumeMessage('We could not verify this purchase. Please try buying again.');
              return;
            }
            setResumeState('failed');
            setResumeMessage(data.error || 'We could not verify your purchase.');
            return;
          }
          // Entitlement verified: generate the report with the server-verified purchase id.
          await generate('loveblueprint', data.purchaseId);
        } catch (e: any) {
          setResumeState('failed');
          setResumeMessage(e?.message || 'Verification failed. Please try again.');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

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
            <a href="#gateway" className="px-8 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
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
                    {p.kind === 'free' ? 'Free' : 'Paid'}
                  </span>
                </div>
                <h3 className="font-serif text-2xl text-white mb-2">{p.name}</h3>
                <p className="text-cosmic-200 text-sm leading-relaxed mb-5">{p.blurb}</p>
              </div>
              <div className="pt-5 border-t border-white/5">
                {p.kind === 'free' ? (
                  <button
                    onClick={() => generate(p.id)}
                    disabled={loading === p.id}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] disabled:opacity-50"
                  >
                    {loading === p.id ? 'Generating…' : p.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => startCheckout(p.id)}
                    disabled={checkoutLoading === p.id}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] disabled:opacity-50"
                  >
                    {checkoutLoading === p.id ? 'Loading…' : p.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pt-16">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
          <i className="fa-solid fa-shield-halved text-gold text-xl mb-3" />
          <p className="text-cosmic-100 text-sm">Your birth metrics are sacred. We reuse your saved chart so you never re-enter them, and your data isn't sold or shared.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        {resumeState === 'checking' && (
          <div className="text-center text-cosmic-100 glass-panel p-6 rounded-2xl border border-gold/20">
            <i className="fa-solid fa-circle-check text-gold text-xl mb-3" />
            <p className="text-sm">{resumeMessage}</p>
          </div>
        )}
        {resumeState === 'pending' && (
          <div className="text-center text-cosmic-100 glass-panel p-6 rounded-2xl border border-gold/20">
            <i className="fa-solid fa-spinner fa-spin text-gold text-xl mb-3" />
            <p className="text-sm">{resumeMessage}</p>
          </div>
        )}
        {resumeState === 'failed' && resumeMessage && (
          <div className="text-center text-rose-300 glass-panel p-6 rounded-2xl border border-rose-400/20">
            {resumeMessage}
          </div>
        )}
        {error && resumeState !== 'pending' && resumeState !== 'checking' && resumeState !== 'ready' && (
          <div className="text-center text-rose-300 glass-panel p-6 rounded-2xl border border-rose-400/20">
            {error}
          </div>
        )}
        {result && resumeState === 'ready' && (
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
            <ReportResult
              type={result.type as any}
              title={result.title}
              overview={result.overview || []}
              sections={result.sections || []}
              readingId={result.readingId}
              shareUrl={shareUrl ?? undefined}
              onShare={result.readingId ? () => shareReport(result.readingId!) : undefined}
            />
          )
        )}
      </section>
    </div>
  );
}
