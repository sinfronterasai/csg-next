import SpreadMenu from "@/components/tarot/SpreadMenu";

export const metadata = { title: "Tarot — Cosmic Spirit Guide" };

export default function TarotPage() {
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
          <SpreadMenu />
        </div>
      </div>
    </main>
  );
}
