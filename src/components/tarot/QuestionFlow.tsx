"use client";

import { useState } from "react";
import { spreads, getSpread } from "@/lib/tarot/spreads";

interface Recommendation {
  spreadId: string;
  spreadName: string;
  reason: string;
  fallback: boolean;
}

const CATEGORIES = [
  { value: "love", label: "Love & Relationship" },
  { value: "career", label: "Career & Work" },
  { value: "decision", label: "A Decision" },
  { value: "general", label: "General" },
];

export default function QuestionFlow({ onRecommended }: { onRecommended: (rec: Recommendation, question: string) => void }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  async function submit() {
    if (!question.trim()) {
      setError("Ask a question to get a spread recommendation.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tarot/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not get a recommendation.");
        return;
      }
      // Tolerant of either a wrapped response (API returns { recommendation })
      // or a bare recommendation object returned by mocks/tests.
      setRec(data.recommendation ?? data);
      setShowPicker(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function acceptRecommendation() {
    if (rec) onRecommended(rec, question);
  }

  function chooseSpread(id: string) {
    const s = getSpread(id);
    if (!s) return;
    onRecommended(
      {
        spreadId: s.id,
        spreadName: s.name,
        reason: "",
        fallback: s.tier === "free",
      },
      question,
    );
  }

  return (
    <div className="glass-panel glow-border w-full max-w-xl mx-auto rounded-2xl p-6">
      <h2 className="font-serif text-xl font-semibold text-gold glow-text-gold">Ask your question</h2>
      <p className="mt-1 text-sm text-cosmic-200/80">
        We will recommend the spread that fits your situation.
      </p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What is on your mind?"
        rows={3}
        className="mt-4 w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={category === c.value}
            onClick={() => setCategory(c.value)}
            className={`rounded-full px-3 py-1 text-sm border ${
              category === c.value
                ? "border-gold text-gold"
                : "border-cosmic-700 text-cosmic-200/70"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-gold/90 px-4 py-2 font-medium text-cosmic-950 hover:bg-gold disabled:opacity-50 glow-text-gold"
      >
        {loading ? "Reading the cards..." : "Recommend a spread"}
      </button>

      {rec && (
        <div className="mt-5 rounded-lg border border-gold/30 bg-cosmic-950/70 p-4">
          <p className="text-sm text-cosmic-200/70">Recommended spread</p>
          <p className="text-lg font-semibold text-gold">{rec.spreadName}</p>
          <p className="mt-1 text-sm text-cosmic-100/90">{rec.reason}</p>
          {rec.fallback && (
            <p className="mt-2 text-xs text-cosmic-300/80">
              This is a free reading. Upgrade for the full Premium spread.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={acceptRecommendation}
              className="rounded-lg bg-gold/90 px-4 py-2 font-medium text-cosmic-950 hover:bg-gold glow-text-gold"
            >
              Start reading
            </button>
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              aria-expanded={showPicker}
              className="rounded-lg border border-cosmic-700 px-4 py-2 text-sm text-cosmic-100 hover:border-gold hover:text-gold"
            >
              Choose different spread
            </button>
          </div>

          {showPicker && (
            <div className="mt-4 grid gap-2">
              {spreads.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => chooseSpread(s.id)}
                  className="rounded-lg border border-cosmic-700 bg-cosmic-950/60 p-3 text-left hover:border-gold"
                >
                  <span className="font-semibold text-gold">{s.name}</span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-cosmic-300/80">
                    {s.tier}
                  </span>
                  <p className="mt-1 text-sm text-cosmic-100/90">{s.blurb}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
