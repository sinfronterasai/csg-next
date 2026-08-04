import Link from "next/link";
import { spreads } from "@/lib/tarot/spreads";

export const metadata = { title: "Spreads — Cosmic Spirit Guide" };

export default function TarotSpreadsPage() {
  return (
    <main className="min-h-screen bg-cosmic-950 px-4 py-10 text-cosmic-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-center text-3xl font-bold text-gold glow-text-gold">
          Tarot Spreads
        </h1>
        <p className="mt-2 text-center text-cosmic-200/80">
          Five ways to read the cards. Pick the depth that fits your question.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {spreads.map((s) => (
            <Link
              key={s.id}
              href="/tarot"
              className="glass-panel glow-border block rounded-2xl p-5 hover:border-gold"
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg font-semibold text-gold">
                  {s.name}
                </span>
                <span className="rounded-full border border-cosmic-700 px-2 py-0.5 text-xs uppercase tracking-wide text-cosmic-300/80">
                  {s.tier}
                </span>
              </div>
              <p className="mt-2 text-sm text-cosmic-100/90">{s.blurb}</p>
              <p className="mt-3 text-xs text-cosmic-300/80">
                {s.positions.length} card{s.positions.length === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-cosmic-200/80">
          <Link href="/tarot" className="text-gold hover:underline">
            Start a reading &rarr;
          </Link>
        </p>
      </div>
    </main>
  );
}
