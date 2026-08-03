"use client";

import type { ReadingViewModel } from "@/lib/tarot/view";

export default function ReadingView({ reading }: { reading: ReadingViewModel }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold text-gold">{reading.question}</h2>

      {reading.astrology && (
        <p className="mt-2 rounded-lg border border-cosmic-700 bg-cosmic-950/60 px-3 py-2 text-sm text-cosmic-200/80">
          <span className="text-gold">Astrology blend:</span> {reading.astrology.summary}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reading.cards.map((c, i) => (
          <div key={i} className="rounded-xl border border-cosmic-700 bg-cosmic-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-cosmic-300/70">{c.positionLabel}</p>
            <p className="mt-1 text-lg font-medium text-gold">
              {c.name} {c.reversed ? "(Reversed)" : ""}
            </p>
            <p className="mt-1 text-sm text-cosmic-100/90">{c.meaning}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-gold/20 bg-cosmic-900/60 p-6">
        <h3 className="text-lg font-semibold text-gold">Your Reading</h3>
        <p className="mt-3 whitespace-pre-line text-cosmic-100/95 leading-relaxed">
          {reading.interpretation}
        </p>
      </div>
    </div>
  );
}
