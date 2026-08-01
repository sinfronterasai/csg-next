'use client';

import { useState } from 'react';
import BirthChartWheel from '../../components/BirthChartWheel';

export default function BirthChart() {
  const [formData, setFormData] = useState({ name: '', date: '', time: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; chart: any; birthInfo: any } | null>(null);
  const [rectified, setRectified] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        name: `${formData.name || 'Alex'}'s Map`,
        chart: {
          planets: {
            sun: { longitude: 45, retrograde: false },
            moon: { longitude: 120, retrograde: false },
            mercury: { longitude: 78, retrograde: true }
          },
          dignities: {
            sun: 'domicile',
            moon: 'exaltation'
          }
        },
        birthInfo: {
          date: formData.date,
          time: formData.time,
          location: formData.location,
          rectified
        }
      });
      setLoading(false);
    }, 600);
  };

  const reset = () => {
    setResult(null);
    setFormData({ name: '', date: '', time: '', location: '' });
  };

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
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all"
                      placeholder="Alex"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Exact Birth Time</label>
                    <input
                      type="time"
                      required
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gold mb-2">Birth Location</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-all"
                      placeholder="Paris, France"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="rectified"
                    checked={rectified}
                    onChange={(e) => setRectified(e.target.checked)}
                    className="rounded bg-white/5 border-white/10 text-gold focus:ring-0"
                  />
                  <label htmlFor="rectified" className="text-xs text-gray-400 cursor-pointer">I don&apos;t know my exact time of birth (Use Solar Houses)</label>
                </div>

                <button type="submit" className="w-full py-4 bg-gradient-to-r from-gold-600 to-gold text-cosmic-950 font-bold uppercase tracking-widest text-xs rounded-xl transform hover:-translate-y-0.5 transition-all shadow-[0_0_20px_rgba(223,183,108,0.2)]">
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
                  <p className="text-sm text-gray-400">Mapping the transits of Venus, Mars, Mercury, and the Ascendant relative to your cosmic entry.</p>
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
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Provide your birth coordinates on the left. Our celestial geometry engine will instantly chart planetary alignments across the Houses.
                  </p>
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

                  <div className="flex justify-center">
                    <BirthChartWheel chartData={result.chart} birthInfo={result.birthInfo} interactive />
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
