'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BirthChartWheel from '../../components/BirthChartWheel';
import type { ChartData } from '../../lib/chartEngine';
import { getSign } from '../../lib/astrology';

export default function MyChart() {
  const router = useRouter();
  const [savedChart, setSavedChart] = useState<ChartData | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'missing' | 'error'>('loading');

  // Single source of truth: the saved chart comes from GET /api/birth-chart,
  // which reads the user's stored natal_charts record (same engine as /birth-chart).
  useEffect(() => {
    fetch('/api/birth-chart', { method: 'GET', credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) {
          // Not signed in (or session expired) — send to the creation flow.
          router.replace('/birth-chart');
          return null;
        }
        const data = await r.json();
        if (!data.hasChart) {
          setStatus('missing');
          return null;
        }
        return data;
      })
      .then((data) => {
        if (!data) return;
        setSavedChart(data.chart as ChartData);
        setStatus('found');
      })
      .catch(() => setStatus('error'));
  }, [router]);

  const coreSign = savedChart ? getSign(savedChart.sun.sign) : null;
  const emoSign = savedChart ? getSign(savedChart.moon.sign) : null;

  return (
    <section className="py-24 relative z-10 constellation-map">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Your Saved Chart</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">My Natal Chart</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
        </div>

        <div className="glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 max-w-2xl mx-auto">
          {status === 'loading' && (
            <div className="text-center text-gray-400 py-12">Aligning celestial bodies...</div>
          )}

          {status === 'missing' && (
            <div className="text-center py-12 space-y-6">
              <p className="text-gray-300">You haven&apos;t generated a chart yet.</p>
              <a href="/birth-chart" className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_25px_rgba(223,183,108,0.5)]">
                Create Your Chart
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center text-gray-400 py-12">The stars are out of reach. Try again shortly.</div>
          )}

          {status === 'found' && savedChart && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass-panel-light p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Core Signature</span>
                  <span className="text-base font-serif text-white block mt-1">{savedChart.sun.label} in {savedChart.sun.signLabel}</span>
                  <span className="text-xs text-gold">{coreSign?.element} • {coreSign?.modality}</span>
                </div>
                <div className="glass-panel-light p-4 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Emotional Self</span>
                  <span className="text-base font-serif text-white block mt-1">{savedChart.moon.label} in {savedChart.moon.signLabel}</span>
                  <span className="text-xs text-gold">{emoSign?.element} • {emoSign?.modality}</span>
                </div>
              </div>

              <BirthChartWheel chartData={savedChart} interactive />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
