"use client";

import { useState } from "react";
import PricingTable from "@/components/tarot/PricingTable";
import type { Tier } from "@/lib/tarot/spreads";

export default function TarotPricing() {
  const [selected, setSelected] = useState<Tier | null>(null);

  async function handleSelect(tier: Tier) {
    setSelected(tier);
    if (tier === 'free') return;
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Checkout failed:', data.error);
      }
    } catch (e) {
      console.error('Checkout request failed', e);
    }
  }

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 py-10 text-cosmic-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-center text-3xl font-bold text-gold glow-text-gold">Tarot Membership</h1>
        <p className="mt-2 text-center text-cosmic-200/80">
          Choose the depth of reading that fits you.
        </p>
        <div className="mt-8">
          <PricingTable onSelectTier={handleSelect} />
        </div>
        {selected && (
          <p className="mt-6 text-center text-sm text-cosmic-200/80">
            Selected <span className="text-gold">{selected}</span>. Stripe Checkout will be wired in the billing workstream.
          </p>
        )}
      </div>
    </main>
  );
}
