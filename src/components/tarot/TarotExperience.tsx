"use client";

import { useState } from "react";
import QuestionFlow from "./QuestionFlow";
import type { Recommendation } from "@/lib/tarot/recommendApi";
import { buildReadingView, type ApiReading } from "@/lib/tarot/view";
import ReadingView from "./ReadingView";

const QUICK_ACTIONS = [
  { label: "Ask the Cards", href: "/tarot" },
  { label: "Daily Reading", href: "/tarot/daily" },
  { label: "Browse Spreads", href: "/tarot/spreads" },
  { label: "My History", href: "/tarot/history" },
];

interface Step {
  phase: "ask" | "draw" | "reading";
  recommendation?: Recommendation;
  reading?: ReturnType<typeof buildReadingView>;
  error?: string | null;
}

export default function TarotExperience() {
  const [step, setStep] = useState<Step>({ phase: "ask" });
  const [seed] = useState(() => Math.random().toString(36).slice(2));

  async function onRecommended(rec: Recommendation, question: string) {
    setStep({ phase: "draw", recommendation: rec });
    try {
      const res = await fetch("/api/tarot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadId: rec.spreadId,
          question,
          seed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStep({ phase: "ask", error: data.error || "Could not generate a reading." });
        return;
      }
      const view = buildReadingView(data as ApiReading);
      setStep({ phase: "reading", recommendation: rec, reading: view });
    } catch {
      setStep({ phase: "ask", error: "Network error generating reading." });
    }
  }

  return (
    <div className="py-8">
      {step.phase === "ask" && (
        <>
          <section className="mx-auto mb-8 w-full max-w-xl text-center">
            <h1 className="font-serif text-3xl font-semibold text-gold glow-text-gold">
              What is calling for your attention?
            </h1>
            <p className="mt-2 text-sm text-cosmic-200/80">
              Choose a path below, or pose your question to the deck.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUICK_ACTIONS.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  className="rounded-lg border border-cosmic-700 px-3 py-2 text-sm text-cosmic-100 hover:border-gold hover:text-gold"
                >
                  {a.label}
                </a>
              ))}
            </div>
          </section>
          <QuestionFlow onRecommended={(rec, q) => onRecommended(rec, q)} />
          {step.error && <p className="mt-4 text-center text-sm text-red-400">{step.error}</p>}
        </>
      )}
      {step.phase === "draw" && (
        <p className="text-center text-gold">Drawing your cards...</p>
      )}
      {step.phase === "reading" && step.reading && (
        <ReadingView reading={step.reading} />
      )}
    </div>
  );
}
