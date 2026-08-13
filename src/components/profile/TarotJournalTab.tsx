'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TarotItem {
  id: number;
  question: string;
  createdAt: string;
}

export default function TarotJournalTab() {
  const [items, setItems] = useState<TarotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      setError(false);
      try {
        const res = await fetch('/api/tarot/history');
        if (res.status === 401) {
          // session expired — surface a sign-in state rather than "no readings"
          setError(true);
        } else if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center text-cosmic-300 py-12">Loading…</div>;

  if (error) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-triangle-exclamation text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">Couldn’t Load Journal</h3>
      <p className="text-cosmic-200 mb-6">Something went wrong fetching your readings.</p>
      <Link href="/login" className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition">Sign In</Link>
    </div>
  );

  if (items.length === 0) return (
    <div className="glass-panel glow-border rounded-2xl p-12 text-center">
      <i className="fa-solid fa-layer-group text-6xl text-gold mb-6"></i>
      <h3 className="font-serif text-2xl font-bold text-gold mb-3">No Readings Yet</h3>
      <p className="text-cosmic-200 mb-6">Your tarot journal will grow with each reading. Draw your first card to begin.</p>
      <Link href="/tarot" className="inline-block bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-8 py-3 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition">Draw Tarot</Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={item.id} href={`/tarot/reading/${item.id}`} className="glass-panel glow-border rounded-2xl p-5 block hover:border-gold transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-serif text-lg font-semibold text-gold group-hover:text-cosmic-100 transition">{item.question}</h4>
              <p className="text-sm text-cosmic-300 mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
            <i className="fa-solid fa-chevron-right text-gold group-hover:translate-x-1 transition-transform"></i>
          </div>
        </Link>
      ))}
    </div>
  );
}
