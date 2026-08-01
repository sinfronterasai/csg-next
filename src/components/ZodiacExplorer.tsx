'use client';

// Interactive click-to-explain Zodiac explorer.
// Data comes exclusively from src/lib/astrology.ts (single source of truth).
// NOTE: this component must stay free of the natal-chart calculation engine.
// That engine breaks prerendering and is only ever loaded via dynamic import.

import { useState } from 'react';
import { SIGNS, type SignInfo, type Element } from '../lib/astrology';

const ELEMENT_STYLES: Record<Element, { text: string; border: string; bg: string; dot: string }> = {
  Fire: { text: 'text-orange-300', border: 'border-orange-400/40', bg: 'bg-orange-500/10', dot: 'bg-orange-400' },
  Earth: { text: 'text-emerald-300', border: 'border-emerald-400/40', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  Air: { text: 'text-sky-300', border: 'border-sky-400/40', bg: 'bg-sky-500/10', dot: 'bg-sky-400' },
  Water: { text: 'text-violet-300', border: 'border-violet-400/40', bg: 'bg-violet-500/10', dot: 'bg-violet-400' },
};

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel-light rounded-xl px-3 py-2">
      <span className="block text-[9px] tracking-[0.18em] uppercase text-gray-400">{label}</span>
      <span className="block text-sm text-white font-serif mt-0.5">{value}</span>
    </div>
  );
}

export default function ZodiacExplorer() {
  const [selected, setSelected] = useState<SignInfo | null>(null);

  const selectZodiac = (key: string) => {
    const next = SIGNS.find((s) => s.key === key);
    if (!next) return;
    setSelected((prev) => (prev && prev.key === next.key ? null : next));
  };

  const palette = selected ? ELEMENT_STYLES[selected.element] : null;

  return (
    <section id="zodiac-explorer" className="w-full">
      <div className="text-center mb-8">
        <span className="text-[10px] tracking-[0.25em] text-gold uppercase block mb-2">Click Any Sign</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          The Twelve{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold to-white glow-text-gold">Archetypes</span>
        </h2>
        <p className="text-sm text-gray-400 mt-3 max-w-xl mx-auto font-light">
          Every glyph below is interactive. Select a sign to reveal its dates, element, ruling planet, modality, and what it actually means.
        </p>
      </div>

      <div id="zodiac-grid" className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {SIGNS.map((sign) => {
          const style = ELEMENT_STYLES[sign.element];
          const isActive = selected?.key === sign.key;
          return (
            <button
              key={sign.key}
              type="button"
              onClick={() => selectZodiac(sign.key)}
              aria-pressed={isActive}
              aria-label={`${sign.label}, ${sign.dates}`}
              className={`group glass-panel rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${isActive ? 'border-gold/70 bg-gold/10 glow-border -translate-y-1' : 'border-white/10 hover:border-gold/40'}`}
            >
              <span className={`text-2xl sm:text-3xl leading-none transition-colors ${isActive ? 'text-gold' : `${style.text} group-hover:text-gold`}`}>
                {sign.glyph}
              </span>
              <span className={`mt-2 text-[11px] sm:text-xs font-serif tracking-wide ${isActive ? 'text-white' : 'text-gray-300'}`}>
                {sign.label}
              </span>
              <span className="mt-1 flex items-center gap-1">
                <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                <span className="text-[8px] tracking-[0.15em] uppercase text-gray-500">{sign.element}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id="zodiac-detail-box" className="mt-6" aria-live="polite">
        {selected && palette ? (
          <article className={`glass-panel rounded-[28px] p-6 sm:p-8 border ${palette.border} glow-border`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center border ${palette.border} ${palette.bg}`}>
                  <span className={`text-3xl ${palette.text}`}>{selected.glyph}</span>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-serif text-white leading-tight">{selected.label}</h3>
                  <span className="text-xs tracking-[0.15em] uppercase text-gold">{selected.dates}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close explanation"
                className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm sm:text-base text-gray-300 leading-relaxed mt-5">{selected.explanation}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {selected.traits.map((trait) => (
                <span
                  key={trait}
                  className={`text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border ${palette.border} ${palette.bg} ${palette.text}`}
                >
                  {trait}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
              <DetailStat label="Element" value={selected.element} />
              <DetailStat label="Modality" value={selected.modality} />
              <DetailStat label="Ruling Planet" value={selected.ruler} />
              <DetailStat label="Lucky Number" value={selected.number} />
              <DetailStat label="Power" value={selected.power} />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-white/10">
              <span className="text-xs text-gray-400">
                Best matches: <span className="text-white font-serif">{selected.love}</span>
              </span>
              <a
                href="/birth-chart"
                className="self-start sm:self-auto inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white font-semibold tracking-widest rounded-full uppercase text-[10px] transition-all duration-300 hover:shadow-[0_0_25px_rgba(138,43,226,0.45)]"
              >
                See {selected.label} in your chart
              </a>
            </div>
          </article>
        ) : (
          <div className="glass-panel-light rounded-[28px] p-8 text-center border border-white/10">
            <i className="fa-solid fa-hand-pointer text-gold/70 text-2xl mb-3 block" />
            <p className="text-sm text-gray-400">
              Select a zodiac sign above to read its full explanation — dates, element, ruling planet, modality, and core meaning.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
