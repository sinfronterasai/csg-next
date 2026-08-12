"use client";

import { useEffect, useRef, useState } from "react";
import type { Spread } from "@/lib/tarot/spreads";

const EXAMPLES: Record<string, string[]> = {
  past_present_future: [
    "How did I get to where I am?",
    "Where is this relationship heading?",
    "What should I prepare for?",
  ],
  celtic_cross: [
    "Should I take this offer?",
    "What is really blocking my progress?",
    "Is this the right move for my family?",
  ],
  relationship_dynamics: [
    "Where do we truly stand?",
    "Why has there been distance lately?",
    "Is this worth fighting for?",
  ],
  career_crossroads: [
    "Which path should I take?",
    "Should I stay or leave?",
    "What is my real advantage here?",
  ],
};

interface Props {
  spread: Spread;
  /** Pre-fill the textarea (e.g. when reopening after a failed draw). */
  initialQuestion?: string;
  /** True once a draw attempt returned 403 UPGRADE_REQUIRED. */
  upgrade?: boolean;
  /** Non-upgrade API failure message to surface. */
  error?: string | null;
  submitting?: boolean;
  onSubmit: (question: string) => void;
  onClose: () => void;
}

export default function QuestionModal({
  spread,
  initialQuestion = "",
  upgrade,
  error,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [validation, setValidation] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const examples = EXAMPLES[spread.id];

  // Focus management: move focus into the dialog on open, trap Tab, restore on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    // Move focus to the first focusable element inside the dialog.
    const first = focusable()[0];
    (first ?? dialog).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      // Restore focus to the element that opened the dialog.
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  function handleSubmit() {
    if (!question.trim()) {
      setValidation("Please enter a question to draw your cards.");
      return;
    }
    setValidation(null);
    onSubmit(question.trim());
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-cosmic-950/80 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${spread.name} question`}
      tabIndex={-1}
    >
      <div className="glass-panel glow-border w-full max-w-md rounded-t-2xl border-cosmic-700 bg-cosmic-950 p-6 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-gold glow-text-gold">{spread.name}</h2>
            <p className="mt-1 text-sm text-cosmic-200/80">{spread.priceLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] rounded-lg border border-cosmic-700 px-3 text-cosmic-200 hover:border-gold hover:text-gold"
          >
            &#10005;
          </button>
        </div>

        {upgrade ? (
          <div className="mt-5 rounded-lg border border-gold/30 bg-cosmic-900/70 p-4">
            <p className="text-sm text-cosmic-100">
              This is a Member reading &mdash; $4.99 or Cosmic Pass. Unlock every Premium spread and the full
              deep-dive readings.
            </p>
            <a
              href="/tarot/pricing"
              className="mt-4 block w-full rounded-lg bg-gold/90 px-4 py-3 text-center font-medium text-cosmic-950 hover:bg-gold min-h-[44px]"
            >
              Become a Member &middot; $4.99
            </a>
          </div>
        ) : (
          <>
            <label htmlFor="tarot-question" className="mt-4 block text-sm text-cosmic-100">
              What&rsquo;s your question?
            </label>
            <textarea
              id="tarot-question"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (validation) setValidation(null);
              }}
              placeholder="What's your question?"
              rows={3}
              className="mt-2 w-full rounded-lg border border-cosmic-700 bg-cosmic-950/80 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
            />
            {examples && (
              <ul className="mt-2 space-y-0.5 text-xs text-cosmic-300/80">
                {examples.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            )}
            {validation && <p className="mt-2 text-sm text-red-400">{validation}</p>}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 w-full rounded-lg bg-gold/90 px-4 py-3 font-medium text-cosmic-950 hover:bg-gold disabled:opacity-50 glow-text-gold min-h-[44px]"
            >
              {submitting ? "Drawing your cards..." : "Reveal my reading"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
