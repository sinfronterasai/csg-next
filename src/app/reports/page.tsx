'use client';

import { useState } from 'react';
import Link from 'next/link';

const PRODUCTS = [
  { id: 'transit', name: 'Yearly Transit Forecast', price: '$49', blurb: 'Map planetary movements relative to your life nodes over the next 12 months.', icon: 'fa-clock-rotate-left' },
  { id: 'synastry', name: 'Synastry Love Report', price: '$65', blurb: 'Overlay two charts to unlock structural compatibility, friction zones, and soul-contract links.', icon: 'fa-heart-circle-bolt' },
  { id: 'vocation', name: 'Vocation and Wealth Map', price: '$55', blurb: 'Decode Midheaven aspects and 2nd/10th House dynamics for perfect professional alignment.', icon: 'fa-briefcase' },
  { id: 'zoom', name: 'Tarot and Astrological Zoom', price: '$120', blurb: 'A live, 60-minute virtual session with a certified cosmic high-priestess addressing career and destiny.', icon: 'fa-wand-magic-sparkles' },
];

export default function Reports() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(reportId: string) {
    setError(null);
    setLoadingId(reportId);
    try {
      const res = await fetch('/api/create-report-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.requiresBirthChart) {
          window.location.href = '/birth-chart';
          return;
        }
        setError(data?.error || 'Unable to start checkout. Please try again.');
        setLoadingId(null);
        return;
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setError('Unable to start checkout. Please try again.');
      setLoadingId(null);
    } catch {
      setError('Network error. Please try again.');
      setLoadingId(null);
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
            Every report is generated from your saved birth chart. Create your chart first, then request a deep-dive.
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-10 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-200 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-gold/30 transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold text-lg mb-6">
                  <i className={`fa-solid ${p.icon}`} />
                </div>
                <h3 className="text-xl font-serif text-white mb-2 group-hover:text-gold transition-colors">{p.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{p.blurb}</p>
              </div>
              <div className="pt-6 border-t border-white/5 flex justify-between items-center mt-6">
                <span className="font-serif text-gold">{p.price}</span>
                <button
                  type="button"
                  onClick={() => startCheckout(p.id)}
                  disabled={loadingId !== null}
                  className="text-xs uppercase tracking-wider text-white hover:text-gold font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingId === p.id ? 'Redirecting…' : (
                    <>
                      Get Started <i className="fa-solid fa-arrow-right text-[10px]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/birth-chart" className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
            Create Your Birth Chart
          </Link>
        </div>
      </div>
    </section>
  );
}
