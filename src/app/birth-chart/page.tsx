'use client';

import { useState } from 'react';
import BirthChartWheel from '../../components/BirthChartWheel';
import { computeChart, type ChartData } from '../../lib/chartEngine';
import { getSign, formatDegree } from '../../lib/astrology';

export default function BirthChart() {
  const [formData, setFormData] = useState({ name: '', date: '', time: '', location: '', unknownTime: false });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChartData | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    // small delay to show the "aligning" state; computation itself is synchronous
    setTimeout(async () => {
      const chart = await computeChart({
        name: formData.name,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        unknownTime: formData.unknownTime,
      });
      setResult(chart);
      setLoading(false);
    }, 500);
  };

  const reset = () => {
    setResult(null);
    setFormData({ name: '', date: '', time: '', location: '', unknownTime: false });
  };

  const coreSign = result ? getSign(result.sun.sign) : null;
  const emoSign = result ? getSign(result.moon.sign) : null;

  return (
    <section id="birthchart" className="py-24 relative z-10 constellation-map">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs uppercase tracking-[0.4em] text-gold block mb-3">Divine Alignment</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">Calculate Your Natal Chart</h2>
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-serif text-white mb-6">Enter Alignment Details</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">First Name</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all" placeholder="Alex" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Date of Birth</label>
                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Exact Birth Time</label>
                    <input type="time" disabled={formData.unknownTime} required={!formData.unknownTime} value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all disabled:opacity-40" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Birth Location</label>
                    <input type="text" required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all" placeholder="Paris, France" />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input type="checkbox" id="rectified" checked={formData.unknownTime} onChange={(e) => setFormData({ ...formData, unknownTime: e.target.checked })}
                    className="rounded bg-white/5 border-white/10 text-gold focus:ring-0" />
                  <label htmlFor="rectified" className="text-xs text-gray-400 cursor-pointer">I don&apos;t know my exact time of birth (Use Solar Houses)</label>
                </div>
                <button type="submit" className="w-full py-4 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold uppercase tracking-widest text-xs rounded-xl transform hover:-translate-y-0.5 transition-all shadow-[0_0_20px_rgba(223,183,108,0.2)]">
                  Cast Celestial Chart
                </button>
              </form>
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center space-x-4 text-xs text-gray-400">
              <i className="fa-solid fa-shield-halved text-gold"></i>
              <span>Your data is securely processed locally and never stored.</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="w-full h-full min-h-[400px] glass-panel p-8 md:p-12 rounded-[40px] border border-gold/20 flex flex-col items-center justify-center text-center relative overflow-hidden">
              {loading && (
                <div className="space-y-6">
                  <div className="w-16 h-16 border-4 border-t-gold border-white/5 rounded-full animate-spin mx-auto"></div>
                  <h4 className="text-xl font-serif text-white">Aligning Celestial Bodies...</h4>
                  <p className="text-sm text-gray-400">Mapping the transits relative to your cosmic entry.</p>
                </div>
              )}
              {!loading && !result && (
                <div className="space-y-6">
                  <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                    <span className="absolute inset-0 border border-gold/30 rounded-full animate-spin-slow"></span>
                    <span className="absolute inset-2 border border-dashed border-gold/20 rounded-full animate-spin-medium"></span>
                    <i className="fa-solid fa-compass text-gold text-5xl opacity-40"></i>
                  </div>
                  <h4 className="text-xl font-serif text-white">Your Chart Awaits Generation</h4>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">Provide your birth coordinates on the left. Our celestial geometry engine will instantly chart planetary alignments across the Houses.</p>
                </div>
              )}
              {!loading && result && (
                <div className="w-full space-y-6 text-left">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                      <h4 className="text-2xl font-serif text-white">{result.name}</h4>
                      <span className="text-xs text-gold tracking-wider uppercase">NATAL COSMIC CONFIGURATION</span>
                    </div>
                    <i className="fa-solid fa-bahai text-gold text-3xl animate-spin-slow"></i>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-panel-light p-4 rounded-2xl">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Core Signature</span>
                      <span className="text-base font-serif text-white block mt-1">{result.sun.label} in {result.sun.signLabel}</span>
                      <span className="text-xs text-gold">{coreSign?.element} • {coreSign?.modality}</span>
                    </div>
                    <div className="glass-panel-light p-4 rounded-2xl">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Emotional Self</span>
                      <span className="text-base font-serif text-white block mt-1">{result.moon.label} in {result.moon.signLabel}</span>
                      <span className="text-xs text-gold">{emoSign?.element} • {emoSign?.modality}</span>
                    </div>
                  </div>

                  <div className="flex justify-center max-w-sm mx-auto">
                    <BirthChartWheel chartData={result} interactive />
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs text-gold tracking-wider uppercase block">Major Placements</span>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between border-b border-white/5 py-1">
                        <span>Ascendant (1st House)</span>
                        <span className="font-serif text-white">{result.ascendant.signLabel} {formatDegree(result.ascendant.longitude)}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 py-1">
                        <span>Midheaven (10th House)</span>
                        <span className="font-serif text-white">{result.midheaven.signLabel} {formatDegree(result.midheaven.longitude)}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 py-1">
                        <span>Sun (House {result.sun.house ?? '—'})</span>
                        <span className="font-serif text-white">{result.sun.signLabel} {formatDegree(result.sun.longitude)}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 py-1">
                        <span>Moon (House {result.moon.house ?? '—'})</span>
                        <span className="font-serif text-white">{result.moon.signLabel} {formatDegree(result.moon.longitude)}</span>
                      </div>
                    </div>
                  </div>

                  <button onClick={reset} className="text-xs text-gold hover:text-white underline tracking-wider uppercase">Cast Another Chart</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
