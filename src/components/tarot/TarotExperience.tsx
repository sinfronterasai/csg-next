"use client";

import { useState } from "react";
import QuestionFlow from "./QuestionFlow";
import type { Recommendation } from "@/lib/tarot/recommendApi";
import { buildReadingView, type ApiReading } from "@/lib/tarot/view";
import ReadingView from "./ReadingView";

interface Step {
  phase: "ask" | "draw" | "reading";
  recommendation?: Recommendation;
  reading?: ReturnType<typeof buildReadingView>;
  error?: string | null;
}

export default function TarotExperience() {
  const [step, setStep] = useState<Step>({ phase: "ask" });
  const [seed] = useState(() => Math.random().toString(36).slice(2));

  async function onRecommended(rec: Recommendation) {
    setStep({ phase: "draw", recommendation: rec });
    try {
      const res = await fetch("/api/tarot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadId: rec.spreadId,
          question: (window as any).__tarotQuestion || "",
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
          <QuestionFlow onRecommended={(rec) => { (window as any).__tarotQuestion = (document.getElementById("q") as HTMLTextAreaElement)?.value || ""; onRecommended(rec); }} />
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
