'use client';

import { useEffect, useRef, useState } from 'react';

interface MoonSign {
  key: string;
  signLabel: string;
  signGlyph: string;
  degreeInSign: number;
  longitude: number;
  element: string;
  modality: string;
  traits: string[];
  dates: string;
  explanation: string;
}
interface MoonPhase {
  phase: number;
  label: string;
}
interface MoonResult {
  birth: { date: string; time: string; location: string; unknownTime: boolean };
  moonSign: MoonSign;
  moonPhase: MoonPhase;
}

function formatDegree(degree: number): string {
  const norm = ((degree % 360) + 360) % 360;
  const deg = Math.floor(norm);
  const min = Math.floor((norm - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}'`;
}

// Illumination % from the phase fraction: 0.5 (full) = 100%.
function illumination(phase: number): number {
  return Math.round(Math.abs(phase - 0.5) * 2 * 100);
}

export default function MoonCalculator() {
  const [form, setForm] = useState({ date: '1995-06-15', time: '14:30', location: 'Sedona, Arizona', unknownTime: false });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MoonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<0 | 1>(0);
  const starsRef = useRef<HTMLDivElement | null>(null);

  // Decorative starfield (client-only, deterministic-ish).
  useEffect(() => {
    const container = starsRef.current;
    if (!container) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('div');
      const size = Math.random() * 2.5 + 1;
      s.style.cssText = `position:absolute;background:#fff;border-radius:50%;width:${size}px;height:${size}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;opacity:${0.2 + Math.random() * 0.6};animation:twinkle 4s infinite alternate ease-in-out;animation-delay:-${Math.random() * 4000}ms;`;
      frag.appendChild(s);
    }
    container.appendChild(frag);
  }, []);

  const calculate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/moon-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          location: form.location,
          unknownTime: form.unknownTime,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'moon calculation failed');
      }
      const data: MoonResult = await res.json();
      setResult(data);
      setTab(0);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm({ date: '1995-06-15', time: '14:30', location: 'Sedona, Arizona', unknownTime: false });
    setResult(null);
    setError(null);
  };

  const sign = result?.moonSign;

  return (
    <section className="relative min-h-screen constellation-map overflow-x-hidden">
      <div ref={starsRef} className="absolute inset-0 pointer-events-none" />
      <style>{`@keyframes twinkle{0%{opacity:.2}100%{opacity:1}}`}</style>

      <div className="max-w-7xl mx-auto px-6 pt-32 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: intro + form */}
          <div className="lg:col-span-5">
            <div className="sticky top-28">
              <span className="inline-flex items-center gap-x-2 bg-white/5 text-white/60 text-xs tracking-[0.5px] px-4 h-6 rounded-3xl mb-6 border border-white/10">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                FREE • INSTANT
              </span>
              <h1 className="font-serif text-5xl lg:text-6xl leading-none font-light tracking-tight text-white mb-3">
                WHAT IS YOUR<br />MOON SIGN?
              </h1>
              <p className="max-w-xs text-gold/80 text-lg">
                The moon governs your emotions, instincts, and inner world.
              </p>
              <div className="mt-10 border-l-2 border-gold pl-6 max-w-xs">
                <p className="italic text-gold text-sm leading-relaxed">
                  &quot;Unlock your cosmic destiny through the geometry of the heavens.&quot;
                </p>
                <div className="mt-4 flex items-center gap-x-3">
                  <div className="flex">
                    <div className="w-3 h-3 rounded-full bg-[#111113]" />
                    <div className="w-3 h-3 rounded-full bg-[#d4af77] -ml-1" />
                    <div className="w-3 h-3 rounded-full bg-gold -ml-1" />
                    <div className="w-3 h-3 rounded-full bg-[#1a2333] -ml-1" />
                  </div>
                  <div className="text-[10px] text-white/40 tracking-widest">COSMIC SPIRIT GUIDE</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: calculator card */}
          <div className="lg:col-span-7">
            <div className="glass-panel rounded-[28px] border border-gold/20 shadow-2xl overflow-hidden">
              {/* tab header */}
              <div className="px-8 pt-6 pb-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-x-8">
                  <button onClick={() => setTab(0)}
                    className={`flex items-center gap-x-2 text-sm font-medium cursor-pointer pb-1 border-b-2 transition-colors ${tab === 0 ? 'border-gold text-white' : 'border-transparent text-white/60 hover:text-white/90'}`}>
                    <i className="fa-solid fa-moon" />
                    <span>MOON SIGN</span>
                  </button>
                  <button onClick={() => setTab(1)}
                    className={`flex items-center gap-x-2 text-sm font-medium cursor-pointer pb-1 border-b-2 transition-colors ${tab === 1 ? 'border-gold text-white' : 'border-transparent text-white/60 hover:text-white/90'}`}>
                    <i className="fa-solid fa-star" />
                    <span>MOON PHASE</span>
                  </button>
                </div>
                <div className="flex items-center bg-black/40 rounded-3xl text-[10px] px-3 py-1 font-mono text-gold">
                  <div className="px-3 border-r border-white/10">v1.0</div>
                  <div className="px-3 text-emerald-400">LIVE</div>
                </div>
              </div>

              <div className="p-8 lg:p-10">
                {!result && (
                  <form onSubmit={calculate} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-gold mb-2">DATE OF BIRTH</label>
                        <input type="date" required value={form.date}
                          onChange={(e) => setForm({ ...form, date: e.target.value })}
                          className="w-full bg-white/5 border border-white/20 focus:border-gold rounded-2xl px-5 h-14 text-white outline-none text-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium tracking-widest text-gold mb-2">TIME OF BIRTH</label>
                        <input type="time" required={!form.unknownTime} disabled={form.unknownTime} value={form.time}
                          onChange={(e) => setForm({ ...form, time: e.target.value })}
                          className="w-full bg-white/5 border border-white/20 focus:border-gold rounded-2xl px-5 h-14 text-white outline-none text-lg disabled:opacity-40" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium tracking-widest text-gold mb-2">PLACE OF BIRTH</label>
                      <input type="text" required value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full bg-white/5 border border-white/20 focus:border-gold rounded-2xl px-5 h-14 text-white outline-none" placeholder="Sedona, Arizona" />
                      <div className="text-[10px] text-white/30 mt-1.5 flex items-center gap-x-1">
                        <i className="fa-solid fa-info-circle" />
                        <span>Used for precise lunar positioning</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-x-3">
                        <input type="checkbox" id="mc-unknown" checked={form.unknownTime}
                          onChange={(e) => setForm({ ...form, unknownTime: e.target.checked })}
                          className="w-4 h-4 accent-gold" />
                        <label htmlFor="mc-unknown" className="cursor-pointer text-white/70">Include birth time for accuracy</label>
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="mt-4 w-full h-16 bg-gradient-to-r from-gold via-amber-300 to-gold text-cosmic-950 text-xl font-bold flex items-center justify-center gap-x-3 rounded-3xl active:scale-[0.97] transition-all disabled:opacity-60">
                      {loading ? <span className="animate-spin border-2 border-cosmic-950/30 border-t-cosmic-950 rounded-full w-6 h-6" /> : (<><span>ALIGN WITH THE MOON</span><i className="fa-solid fa-arrow-right text-lg" /></>)}
                    </button>
                    <div className="text-center text-[10px] text-white/30 mt-6 flex items-center justify-center gap-x-5">
                      <div className="h-px w-12 bg-white/10" />
                      <div>NO ACCOUNT REQUIRED</div>
                      <div className="h-px w-12 bg-white/10" />
                    </div>
                  </form>
                )}

                {error && (
                  <div className="text-center py-8">
                    <p className="text-rose-300 text-sm">{error}</p>
                    <button onClick={reset} className="mt-4 px-6 py-2 rounded-3xl border border-white/30 hover:border-gold text-white text-xs">RESET</button>
                  </div>
                )}

                {result && tab === 0 && sign && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="uppercase text-xs tracking-[1px] font-medium text-gold">YOUR MOON SIGN IS</div>
                        <div className="font-serif text-5xl text-white mt-1">{sign.signLabel}</div>
                        <div className="text-7xl text-cyan-200 mt-3 leading-none">{sign.signGlyph}</div>
                      </div>
                      <div className="relative">
                        <div className="w-28 h-28 bg-gradient-to-br from-cyan-100 to-indigo-200 rounded-full flex items-center justify-center text-5xl shadow-2xl glow-border-purple text-cosmic-950">☽</div>
                        <div className="absolute -top-1 -right-1 bg-gold text-[10px] font-mono px-3 py-1 rounded-3xl rotate-12 shadow-md text-cosmic-950">{formatDegree(sign.longitude)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-b border-white/10 py-5 text-sm">
                      <div className="flex items-center gap-x-3">
                        <div className="text-xs bg-white/10 px-4 py-2 rounded-3xl">{sign.element}</div>
                        <div className="font-light text-cyan-200">{sign.modality}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white/40">LUNAR DATES</div>
                        <div className="text-xs text-gold font-medium">{sign.dates}</div>
                      </div>
                    </div>
                    <p className="text-white/80 text-[15px] leading-relaxed">{sign.explanation}</p>
                    <div>
                      <div className="text-xs uppercase font-medium text-white/50 mb-3">KEY TRAITS</div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {sign.traits.map((t) => (
                          <div key={t} className="bg-white/5 text-xs py-3 px-2 rounded-2xl border border-white/10">{t}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-x-4">
                      <button onClick={reset} className="flex-1 border border-white/30 hover:border-white/60 py-5 rounded-3xl text-sm font-medium transition-colors">RECALCULATE</button>
                    </div>
                  </div>
                )}

                {result && tab === 1 && (
                  <div className="space-y-6 text-center">
                    <div className="uppercase text-xs tracking-[1px] font-medium text-gold">CURRENT MOON PHASE</div>
                    <div className="w-40 h-40 mx-auto bg-gradient-to-br from-cyan-100 to-indigo-200 rounded-full flex items-center justify-center text-6xl shadow-2xl glow-border-purple text-cosmic-950">{result.moonPhase.label}</div>
                    <div className="font-serif text-3xl text-white">{result.moonPhase.label}</div>
                    <div className="flex items-center justify-center gap-x-3 text-sm">
                      <span className="text-white/50">Illumination</span>
                      <span className="text-gold font-medium">{illumination(result.moonPhase.phase)}%</span>
                    </div>
                    <p className="text-white/70 text-sm max-w-md mx-auto">
                      The moon was {Math.round(result.moonPhase.phase * 100)}% through its cycle from new to new at this moment.
                    </p>
                    <button onClick={reset} className="border border-white/30 hover:border-white/60 py-4 px-8 rounded-3xl text-sm font-medium transition-colors">NEW CALCULATION</button>
                  </div>
                )}
              </div>

              <div className="bg-black/40 px-8 py-5 flex items-center justify-between text-xs border-t border-white/10">
                <div className="text-white/30"><i className="fa-solid fa-circle-info" /> <span className="ml-2 hidden sm:inline">How it works</span></div>
                <div className="font-mono text-[10px] text-emerald-400 flex items-center gap-x-2">
                  <div className="w-2 h-2 bg-current rounded-full animate-ping" />
                  CELESTIAL ALIGNMENT COMPLETE
                </div>
                <a href="/reports" className="text-white/30 hover:text-gold flex items-center gap-x-1"><i className="fa-solid fa-arrow-right" /><span className="hidden sm:inline">More</span></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
