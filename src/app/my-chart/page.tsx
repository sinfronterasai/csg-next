'use client';

import { useEffect, useState } from 'react';
import BirthChartWheel from '../../components/BirthChartWheel';
import { computeChart, type ChartData } from '../../lib/chartEngine';
import { getSign, formatDegree } from '../../lib/astrology';

export default function MyChart() {
  // Single source of truth: the saved chart is normalized into the same ChartData shape
  // that /birth-chart produces, so the viewer is always identical and accurate.
  // In production this comes from the user's stored record; here we materialize it
  // from the saved birth inputs to prove the shared pipeline.
  const [savedChart, setSavedChart] = useState<ChartData | null>(null);
  useEffect(() => {
    computeChart({ name: 'Alex', date: '1990-01-01', time: '12:00', location: 'New York, NY' })
      .then(setSavedChart);
  }, []);

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
          {!savedChart && <div className="text-center text-gray-400 py-12">Aligning celestial bodies...</div>}
          {savedChart && (
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
          )}
        </div>
      </div>
    </section>
  );
}
