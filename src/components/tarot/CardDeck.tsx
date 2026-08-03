"use client";

import { useEffect, useState } from "react";
import type { DrawnCard } from "@/lib/tarot/draw";
import { layoutForSpread } from "@/lib/tarot/layout";
import CardReveal from "./CardReveal";

export default function CardDeck({
  spreadId,
  drawn,
}: {
  spreadId: string;
  drawn: DrawnCard[];
}) {
  const layout = layoutForSpread(spreadId);
  // Reveal cards one at a time for a tactile draw.
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    setRevealedCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealedCount(i);
      if (i >= drawn.length) clearInterval(id);
    }, 450);
    return () => clearInterval(id);
  }, [drawn.length, spreadId]);

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.rows}, auto)`,
      }}
    >
      {drawn.map((d, idx) => {
        const pos = layout.positions[idx];
        return (
          <div
            key={idx}
            className="flex flex-col items-center"
            style={{ gridColumn: pos?.col, gridRow: pos?.row }}
          >
            <CardReveal card={d.card} reversed={d.reversed} revealed={idx < revealedCount} />
            <p className="mt-1 text-center text-[11px] text-cosmic-200/80">{pos?.label}</p>
          </div>
        );
      })}
    </div>
  );
}
