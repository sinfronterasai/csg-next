"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface HistoryItem {
  id: number;
  spreadId: string;
  question: string;
  category: string | null;
  astrologySummary: string | null;
  createdAt: string;
}

export default function TarotHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tarot/history")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      })
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-cosmic-200/80">Loading your readings...</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (!items.length) return <p className="text-cosmic-200/80">No readings yet. Your saved readings will appear here.</p>;

  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={`/tarot/reading/${it.id}`} className="block rounded-xl border border-cosmic-700 bg-cosmic-900/70 p-4 hover:border-gold/30 transition-all duration-300 cursor-pointer group">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-gold">{it.spreadId.replace(/_/g, " ")}</p>
                <p className="mt-1 text-cosmic-100">{it.question}</p>
                {it.astrologySummary && (
                  <p className="mt-1 text-xs text-cosmic-300/80">Astrology: {it.astrologySummary}</p>
                )}
              </div>
              <i className="fa-solid fa-chevron-right text-gold/50 group-hover:text-gold transition-colors duration-300"></i>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
