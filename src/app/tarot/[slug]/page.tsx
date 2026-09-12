import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { deck, type TarotCard } from "@/lib/tarot/deck";
import { slugify } from "@/lib/seo";

function getCardBySlug(slug: string): TarotCard | undefined {
  return deck.find((c) => slugify(c.name) === slug);
}

export function generateStaticParams() {
  return deck.map((c) => ({ slug: slugify(c.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = getCardBySlug(slug);
  if (!card) return { title: "Tarot Card Not Found" };
  return {
    title: `${card.name} — Tarot Card Meaning | Cosmic Spirit Guide`,
    description: `${card.name} (${card.suit}). Upright: ${card.upright}. Reversed: ${card.reversed}.`,
  };
}

export default async function TarotCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = getCardBySlug(slug);
  if (!card) notFound();

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 py-10 text-cosmic-100">
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-sm uppercase tracking-widest text-cosmic-300">
          {card.suit} arcana
        </p>
        <h1 className="glow-text-gold font-serif pt-2 text-center text-4xl font-bold text-gold">
          {card.name}
        </h1>

        <div className="mt-8 overflow-hidden rounded-2xl border border-gold/30 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.artRef}
            alt={`${card.name} tarot card art`}
            className="mx-auto h-auto w-full max-w-md"
          />
        </div>

        <section className="mt-8 rounded-xl border border-cosmic-700 bg-cosmic-900/60 p-6">
          <h2 className="font-serif text-xl font-semibold text-gold">Upright</h2>
          <p className="mt-2 text-cosmic-200">{card.upright}</p>

          <h2 className="font-serif mt-6 text-xl font-semibold text-gold">Reversed</h2>
          <p className="mt-2 text-cosmic-200">{card.reversed}</p>
        </section>

        <p className="mt-8 text-center text-sm text-cosmic-400">
          <a href="/tarot" className="text-gold underline-offset-4 hover:underline">
            Get a live tarot reading
          </a>
        </p>
      </div>
    </main>
  );
}
