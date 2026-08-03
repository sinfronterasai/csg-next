import TarotExperience from "@/components/tarot/TarotExperience";

export const metadata = { title: "Tarot — Cosmic Spirit Guide" };

export default function TarotPage() {
  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="pt-10 text-center text-3xl font-bold text-gold">Tarot</h1>
        <p className="mt-2 text-center text-cosmic-200/80">
          Ask a question. We will recommend a spread, draw your cards, and read them in context.
        </p>
        <TarotExperience />
      </div>
    </main>
  );
}
