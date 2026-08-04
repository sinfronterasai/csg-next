"use client";

import { motion } from "framer-motion";
import type { TarotCard } from "@/lib/tarot/deck";
import { CARD_BACK_URL } from "@/lib/tarot/deck";

export default function CardReveal({
  card,
  reversed,
  revealed,
}: {
  card: TarotCard;
  reversed: boolean;
  revealed: boolean;
}) {
  return (
    <div className="relative h-48 w-32 [perspective:1000px]">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Back of card (shown before reveal) */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <img
            src={CARD_BACK_URL}
            alt="Card back"
            className="h-full w-full rounded-xl border border-gold/30 object-contain"
          />
        </div>
        {/* Front of card */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-gold/40 bg-cosmic-900 p-2 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <img
            src={card.artRef}
            alt={card.name}
            className="mb-2 h-24 w-16 rounded object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <p className="text-xs font-medium text-gold">{card.name}</p>
          {reversed && <p className="text-[10px] text-cosmic-300">Reversed</p>}
        </div>
      </motion.div>
    </div>
  );
}
