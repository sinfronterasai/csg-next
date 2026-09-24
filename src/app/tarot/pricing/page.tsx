"use client";

import { WHOP_CHECKOUT_URLS } from "@/lib/whopCatalog";

export default function TarotPricing() {
  const paidSpreads = [
    { name: 'Celtic Cross Tarot', price: '$4.99', offer: 'celtic_cross' as const, description: 'A ten-card deep dive into the forces shaping your question.' },
    { name: 'Relationship Dynamics Tarot', price: '$4.99', offer: 'relationship_dynamics' as const, description: 'A focused spread for patterns, perspectives, and relationship choices.' },
    { name: 'Career Crossroads Tarot', price: '$4.99', offer: 'career_crossroads' as const, description: 'A practical spread for navigating a professional decision or turning point.' },
  ];

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 py-10 text-cosmic-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-center text-3xl font-bold text-gold glow-text-gold">Tarot Membership</h1>
        <p className="mt-2 text-center text-cosmic-200/80">Choose a one-time reading for the question in front of you.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {paidSpreads.map((spread) => (
            <div key={spread.offer} className="glass-panel flex flex-col rounded-2xl border border-gold/40 bg-cosmic-950/60 p-6">
              <h2 className="text-xl font-semibold text-gold">{spread.name}</h2>
              <p className="mt-2 text-2xl font-bold text-cosmic-100">{spread.price}</p>
              <p className="mt-3 flex-1 text-sm text-cosmic-200/80">{spread.description}</p>
              <a href={WHOP_CHECKOUT_URLS[spread.offer]} className="mt-6 rounded-lg bg-gold px-4 py-2 text-center font-medium text-cosmic-950 hover:bg-gold/90">
                Buy on Whop
              </a>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-cosmic-200/70">One-time purchase. Your access is unlocked after Whop confirms payment.</p>
      </div>
    </main>
  );
}
