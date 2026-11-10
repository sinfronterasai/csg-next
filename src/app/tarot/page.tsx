import SpreadMenu from "@/components/tarot/SpreadMenu";
import { deck } from "@/lib/tarot/deck";
import { slugify } from "@/lib/seo";

export const metadata = { title: "Tarot — Cosmic Spirit Guide" };

export default async function TarotPage({ searchParams }: { searchParams: Promise<{ spread?: string }> }) {
  const { spread } = await searchParams;
  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif pt-10 text-center text-3xl font-bold text-gold glow-text-gold">
          Choose your reading.
        </h1>
        <p className="mt-2 text-center text-cosmic-200/80">
          Pick a spread. We&rsquo;ll draw your cards and read them in context.
        </p>
        <div className="mt-8">
          <SpreadMenu initialSpreadId={spread} />
        </div>
        <section aria-labelledby="card-meanings" className="py-12">
          <h2 id="card-meanings" className="font-serif text-2xl text-gold">Tarot card meanings</h2>
          <p className="mt-3 text-cosmic-200/80">Explore the upright and reversed meanings of all 78 cards, or <a href="/quizzes/tarot-archetype" className="text-gold underline">discover your tarot archetype</a>.</p>
          {([['major', 'Major Arcana'], ['wands', 'Wands'], ['cups', 'Cups'], ['swords', 'Swords'], ['pentacles', 'Pentacles']] as const).map(([suit, label]) => (
            <div key={suit} className="mt-8">
              <h3 className="font-serif text-xl text-gold">{label}</h3>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {deck.filter((card) => card.suit === suit).map((card) => (
                  <li key={card.id}><a href={`/tarot/${slugify(card.name)}`} className="block rounded-lg border border-white/10 px-3 py-2 text-cosmic-200 hover:border-gold hover:text-gold">{card.name}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
