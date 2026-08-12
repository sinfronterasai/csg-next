'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Card = { name: string; reversed: boolean; artRef: string; positionLabel: string; upright: string; reversedMeaning: string };
type Reading = { id: string; spreadId: string; question: string; drawn: Card[]; interpretation: string; createdAt: string };

export default function ReadingDetailPage() {
  const params = useParams<{ id: string }>();
  const [reading, setReading] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tarot/reading/${params.id}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Reading not found.' : 'Could not load this reading.');
          setLoading(false);
          return;
        }
        setReading(await res.json());
      } catch {
        setError('Network error.');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) return <main className="min-h-screen bg-cosmic-950 px-4 pt-32 text-cosmic-200">Loading…</main>;
  if (error || !reading) return (
    <main className="min-h-screen bg-cosmic-950 px-4 pt-32 text-cosmic-200">
      <p className="text-center">{error || 'Reading not found.'}</p>
      <p className="mt-4 text-center"><a href="/tarot/history" className="text-gold underline-offset-4 hover:underline">Back to history</a></p>
    </main>
  );

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 py-20 text-cosmic-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="glow-text-gold font-serif text-center text-3xl font-bold text-gold">Your Reading</h1>
        {reading.question && <p className="mt-2 text-center text-cosmic-200/80">“{reading.question}”</p>}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {reading.drawn.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-gold/30 bg-cosmic-900/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.artRef} alt={c.name} className="h-48 w-full object-cover" />
              <div className="p-3">
                <p className="font-serif text-gold">{c.name}{c.reversed ? ' (Reversed)' : ''}</p>
                <p className="mt-1 text-xs text-cosmic-300">{c.positionLabel}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-cosmic-700 bg-cosmic-900/60 p-6 whitespace-pre-wrap leading-relaxed text-cosmic-200">
          {reading.interpretation}
        </section>

        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          <a href="/tarot" className="text-gold underline-offset-4 hover:underline">New reading</a>
          <span className="text-cosmic-500">·</span>
          <a href="/tarot/history" className="text-gold underline-offset-4 hover:underline">My readings</a>
        </div>
      </div>
    </main>
  );
}
