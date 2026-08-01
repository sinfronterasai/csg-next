'use client';

import { useEffect, useState } from 'react';
import ZodiacExplorer from '../components/ZodiacExplorer';
import About from '../components/About';
import Services from '../components/Services';
import Newsletter from '../components/Newsletter';
import Footer from '../components/Footer';
import type { ChartData } from '../lib/chartEngine';
import { getSign } from '../lib/astrology';

export default function Home() {
  // Real "current sky": compute a chart for right now at Greenwich (location-independent
  // for Sun/Moon sign; Ascendant shown for the reference longitude). Single source of truth.
  const [transit, setTransit] = useState<{ sun: string; moon: string; asc: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
    const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    fetch('/api/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'The Sky', date, time, location: 'Greenwich, UK' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: ChartData | null) => {
        if (c) setTransit({ sun: c.sun.signLabel, moon: c.moon.signLabel, asc: c.ascendant.signLabel });
        else setTransit({ sun: '—', moon: '—', asc: '—' });
      })
      .catch(() => setTransit({ sun: '—', moon: '—', asc: '—' }));
  }, []);

  return (
    <main className="relative overflow-hidden">
      <section className="relative min-h-screen flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 w-full relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 border border-gold/30 rounded-full bg-gold/5 self-center lg:self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-ping" />
              <span className="text-[10px] tracking-widest text-gold uppercase">The Stars Are Aligned</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight">
              Unlock Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-300 to-white glow-text-gold">Cosmic Destiny</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-300 max-w-xl mx-auto lg:mx-0 font-light leading-relaxed">
              Journey through the geometry of the heavens. Our advanced interactive charts decode the ancient alignments of stars and planets to reveal your unique path, soul purpose, and celestial design.
            </p>

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center lg:justify-start pt-4">
              <a href="/birth-chart" className="px-8 py-4 bg-gradient-to-r from-gold-600 via-gold to-gold-400 text-cosmic-950 font-bold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_30px_rgba(223,183,108,0.5)] transform hover:-translate-y-0.5">
                Free Birth Chart
              </a>
              <a href="/constellations" className="px-8 py-4 glass-panel border border-gold/30 text-white font-semibold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:bg-white/5">
                Explore Constellations
              </a>
              <a href="#zodiac-explorer" className="px-8 py-4 glass-panel border border-white/10 text-gray-200 font-semibold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:border-gold/40 hover:text-white">
                Explore The Zodiac
              </a>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/5 max-w-lg mx-auto lg:mx-0">
              <div>
                <span className="block text-2xl lg:text-3xl font-serif text-gold">12</span>
                <span className="text-[10px] tracking-widest uppercase text-gray-400">Zodiac Archetypes</span>
              </div>
              <div>
                <span className="block text-2xl lg:text-3xl font-serif text-gold">88</span>
                <span className="text-[10px] tracking-widest uppercase text-gray-400">Constellations</span>
              </div>
              <div>
                <span className="block text-2xl lg:text-3xl font-serif text-gold">100%</span>
                <span className="text-[10px] tracking-widest uppercase text-gray-400">Personalized</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center items-center pointer-events-none lg:pointer-events-auto">
            <div className="w-full max-w-md glass-panel p-8 rounded-[40px] text-center relative border border-gold/20 glow-border">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 glass-panel rounded-full flex items-center justify-center border-gold/40">
                <i className="fa-solid fa-compass-drafting text-gold text-3xl" />
              </div>

              <div className="mt-8 space-y-6">
                <span className="text-xs tracking-[0.2em] text-gold uppercase block">Current Celestial Transit</span>

                <div className="border-y border-white/10 py-4 flex justify-around items-center">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">SUN</span>
                    <i className="fa-solid fa-sun text-gold text-lg mb-1" />
                    <span className="block text-sm font-serif">{transit ? transit.sun : '…'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">MOON</span>
                    <i className="fa-solid fa-moon text-gold text-lg mb-1" />
                    <span className="block text-sm font-serif">{transit ? transit.moon : '…'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">RISING</span>
                    <i className="fa-solid fa-star text-gold text-lg mb-1" />
                    <span className="block text-sm font-serif">{transit ? transit.asc : '…'}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed">
                  The cosmos is active. Generate your natal chart to see the exact alignments at your moment of birth.
                </p>

                <a href="/birth-chart" className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white font-semibold tracking-widest rounded-full uppercase text-xs transition-all duration-300 hover:shadow-[0_0_25px_rgba(138,43,226,0.45)]">
                  Calculate Chart
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 py-20 sm:py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 w-full">
          <ZodiacExplorer />
        </div>
      </section>

      <About />
      <Services />
      <Newsletter />
      <Footer />
    </main>
  );
}
