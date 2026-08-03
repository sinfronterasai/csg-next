"use client";

import { tierFeatureMatrix } from "@/lib/tarot/pricing";
import type { Tier } from "@/lib/tarot/spreads";

export default function PricingTable({ onSelectTier }: { onSelectTier?: (tier: Tier) => void }) {
  const tiers = tierFeatureMatrix();
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {tiers.map((t) => (
        <div
          key={t.tier}
          className={`glass-panel flex flex-col rounded-2xl border p-6 ${
            t.highlighted ? "border-gold bg-cosmic-900/80" : "border-cosmic-700 bg-cosmic-950/60"
          }`}
        >
          <h3 className="text-xl font-semibold text-gold">{t.name}</h3>
          <p className="mt-1 text-2xl font-bold text-cosmic-100">
            {t.priceMonthly === 0 ? "Free" : `$${t.priceMonthly.toFixed(2)}`}
            {t.priceMonthly > 0 && <span className="text-sm font-normal text-cosmic-300">/mo</span>}
          </p>
          <p className="mt-2 text-sm text-cosmic-200/80">{t.blurb}</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-cosmic-100/90">
            {t.features.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold">&#10022;</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onSelectTier?.(t.tier)}
            className={`mt-6 rounded-lg px-4 py-2 font-medium ${
              t.highlighted ? "bg-gold text-cosmic-950 hover:bg-gold/90" : "border border-gold/50 text-gold hover:bg-gold/10"
            }`}
          >
            {t.cta}
          </button>
        </div>
      ))}
    </div>
  );
}
