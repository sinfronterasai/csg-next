"use client";

import { useState } from "react";
import type { ReadingViewModel } from "@/lib/tarot/view";
import { exportReadingPdf } from "@/lib/tarot/pdf";

export default function ReadingView({ reading }: { reading: ReadingViewModel }) {
  const [reflection, setReflection] = useState(reading.reflection ?? "");
  const [saved, setSaved] = useState(false);

  async function saveReflection() {
    if (!reading.readingId) return;
    await fetch(`/api/tarot/reading/${reading.readingId}/reflection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reflection }),
    });
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-serif text-2xl font-semibold text-gold glow-text-gold">{reading.question}</h2>

      {reading.astrology && (
        <p className="mt-2 rounded-lg border border-cosmic-700 bg-cosmic-950/60 px-3 py-2 text-sm text-cosmic-200/80">
          <span className="text-gold">Astrology blend:</span> {reading.astrology.summary}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reading.cards.map((c, i) => (
          <div key={i} className="glass-panel rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-cosmic-300/70">{c.positionLabel}</p>
            <p className="mt-1 text-lg font-medium text-gold">
              {c.name} {c.reversed ? "(Reversed)" : ""}
            </p>
            <p className="mt-1 text-sm text-cosmic-100/90">{c.meaning}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel glow-border mt-8 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gold">Your Reading</h3>
        <p className="mt-3 whitespace-pre-line text-cosmic-100/95 leading-relaxed">
          {reading.interpretation}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => exportReadingPdf(reading)}
          className="rounded-lg border border-gold/50 px-4 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Download PDF
        </button>
        {reading.readingId != null && (
          <span className="text-xs text-cosmic-300/70">Premium Plus: journal your reflection below.</span>
        )}
      </div>

      {reading.readingId != null && (
        <div className="glass-panel glow-border mt-6 rounded-2xl p-5">
          <h3 className="text-lg font-semibold text-gold">Reflection</h3>
          <textarea
            value={reflection}
            onChange={(e) => { setReflection(e.target.value); setSaved(false); }}
            rows={3}
            placeholder="What resonated? What will you do next?"
            className="mt-2 w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
          />
          <button type="button" onClick={saveReflection} className="mt-2 rounded-lg bg-gold/90 px-4 py-2 text-sm font-medium text-cosmic-950 hover:bg-gold">
            {saved ? "Saved" : "Save reflection"}
          </button>
        </div>
      )}
    </div>
  );
}
