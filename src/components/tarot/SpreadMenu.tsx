"use client";

import { useState } from "react";
import Link from "next/link";
import { spreads, type Spread } from "@/lib/tarot/spreads";
import { buildReadingView, type ApiReading, type ReadingViewModel } from "@/lib/tarot/view";
import QuestionModal from "./QuestionModal";
import ReadingView from "./ReadingView";

type Phase =
  | { kind: "menu" }
  | { kind: "modal"; spread: Spread; question: string; error?: string | null }
  | { kind: "drawing"; spread: Spread; question: string }
  | { kind: "reading"; view: ReadingViewModel }
  | { kind: "upgrade"; spread: Spread };

function cardCountLabel(spread: Spread): string {
  const n = spread.positions.length;
  return `${n} card${n === 1 ? "" : "s"}`;
}

export default function SpreadMenu() {
  const [phase, setPhase] = useState<Phase>({ kind: "menu" });
  const [seed] = useState(() => Math.random().toString(36).slice(2));

  async function draw(spread: Spread, question: string) {
    setPhase({ kind: "drawing", spread, question });
    try {
      const res = await fetch("/api/tarot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadId: spread.id, question, seed }),
      });
      if (res.status === 403) {
        // Entitlement gate: free user on a premium spread.
        setPhase({ kind: "upgrade", spread });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        // Re-open the modal, preserving the typed question + surfacing the error.
        setPhase({ kind: "modal", spread, question, error: data?.error || "Could not draw your reading." });
        return;
      }
      const view = buildReadingView(data as ApiReading);
      setPhase({ kind: "reading", view });
    } catch {
      setPhase({ kind: "modal", spread, question, error: "Network error. Please try again." });
    }
  }

  function handleSelect(spread: Spread) {
    if (spread.fixedQuestion) {
      // AC3: draw immediately, no modal.
      void draw(spread, spread.fixedQuestion);
      return;
    }
    setPhase({ kind: "modal", spread, question: "" });
  }

  if (phase.kind === "reading") {
    return (
      <div>
        <ReadingView reading={phase.view} />
        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setPhase({ kind: "menu" })}
            className="inline-flex min-h-[44px] items-center text-gold underline-offset-4 hover:underline"
          >
            New reading
          </button>
          <span className="text-cosmic-500">·</span>
          <Link
            href="/tarot/history"
            className="inline-flex min-h-[44px] items-center text-gold underline-offset-4 hover:underline"
          >
            My readings
          </Link>
        </div>
      </div>
    );
  }

  if (phase.kind === "modal") {
    return (
      <QuestionModal
        spread={phase.spread}
        initialQuestion={phase.question}
        error={phase.error ?? null}
        submitting={false}
        onClose={() => setPhase({ kind: "menu" })}
        onSubmit={(q) => void draw(phase.spread, q)}
      />
    );
  }

  if (phase.kind === "upgrade") {
    return (
      <QuestionModal
        spread={phase.spread}
        upgrade
        submitting={false}
        onClose={() => setPhase({ kind: "menu" })}
        onSubmit={() => {}}
      />
    );
  }

  if (phase.kind === "drawing") {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-gold">Drawing your cards for {phase.spread.name}...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spreads.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleSelect(s)}
            className="glass-panel glow-border block rounded-2xl border-cosmic-700 bg-cosmic-950/60 p-5 text-left hover:border-gold"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-lg font-semibold text-gold">{s.name}</span>
              <span className="rounded-full border border-cosmic-700 px-2 py-0.5 text-xs uppercase tracking-wide text-cosmic-300/80">
                {s.tier === "free" ? "Free" : "Member"}
              </span>
            </div>
            <p className="mt-2 text-sm text-cosmic-100/90">{s.blurb}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-cosmic-300/80">
              <span>{cardCountLabel(s)}</span>
              <span className="text-gold">{s.priceLabel}</span>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-cosmic-300/80">
        <Link
          href="/tarot/history"
          className="inline-flex min-h-[44px] items-center justify-center text-gold underline-offset-4 hover:underline"
        >
          My readings
        </Link>
      </p>
    </div>
  );
}
