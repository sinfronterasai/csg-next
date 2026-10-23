import type { Metadata } from 'next';
import RelationshipOfferActions from '@/components/tarot/RelationshipOfferActions';
import { getProduct } from '@/lib/productCatalog';
import { relationshipExample, RELATIONSHIP_OFFER_PATH } from '@/lib/tarot/relationshipOffer';

const product = getProduct('relationship-dynamics-tarot');
export const metadata: Metadata = {
  title: `Relationship Dynamics Tarot Reading — ${product.formattedPrice} | Cosmic Spirit Guide`,
  description: 'Explore one relationship question through six tarot cards and an AI-assisted interpretation. See an example first. One-time payment, no subscription.',
  alternates: { canonical: 'https://cosmicspiritguide.com' + RELATIONSHIP_OFFER_PATH },
  openGraph: { title: 'Less guessing. A clearer question.', description: `Six cards. One relationship question. ${product.formattedPrice}, one time.`, images: ['/campaigns/relationship/offer-social.png'] },
};

export default function RelationshipOfferPage() {
  return (
    <main className="min-h-screen bg-cosmic-950 px-5 py-12 text-cosmic-100">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm uppercase tracking-[0.2em] text-gold">Relationship Dynamics · Six-card tarot reading</p>
        <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-tight text-gold sm:text-6xl">Less guessing.<br />A clearer question.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cosmic-200">When you keep circling the same relationship question, pause and look at the pattern. Explore your perspective, the connection, its strengths and tensions, and a possible next step.</p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <a href="#purchase" className="rounded-full bg-gold px-6 py-3 font-semibold text-cosmic-950">Explore my question — {product.formattedPrice}</a>
          <a href="#example" className="min-h-[44px] py-3 text-gold underline">Read an example first</a>
        </div>
        <p className="mt-4 text-sm text-cosmic-200">AI-assisted interpretation · One-time payment · No subscription</p>
        <section className="mt-14 rounded-2xl border border-gold/30 p-6 sm:p-8" aria-labelledby="inside-heading">
          <h2 id="inside-heading" className="font-serif text-2xl text-gold">One question. Six perspectives.</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">{relationshipExample.map((item) => <div key={item.position}><h3 className="font-semibold text-gold">{item.position}</h3><p className="mt-1 text-sm text-cosmic-200">{({ You: 'Your perspective and needs.', Them: 'A prompt to consider the other perspective.', Connection: 'The dynamic between you.', Strength: 'What you can build on.', Tension: 'A pattern worth addressing.', Path: 'A possible next step to reflect on.' })[item.position]}</p></div>)}</div>
          <p className="mt-6 text-sm text-cosmic-200">Cards are drawn for your question, then interpreted with AI. They cannot reveal someone’s private thoughts or guarantee what will happen. No birth chart is required.</p>
        </section>
        <section id="example" className="mt-14 scroll-mt-8" aria-labelledby="example-heading">
          <p className="text-sm uppercase tracking-widest text-gold">See the format before you buy</p>
          <h2 id="example-heading" className="mt-3 font-serif text-3xl text-gold">“How can I approach a conversation about the distance between us?”</h2>
          <p className="mt-4 text-sm leading-relaxed text-cosmic-200">Editorial example, not a customer reading or a live AI response. These cards come from a reproducible draw using our actual deck; the interpretations below were written for this demonstration. Your cards and wording will differ.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">{relationshipExample.map((item) => <article key={item.position} className="rounded-xl border border-cosmic-700 p-5"><p className="text-xs uppercase tracking-widest text-cosmic-200">{item.position}</p><h3 className="mt-2 font-serif text-xl text-gold">{item.card}{item.reversed ? ' · Reversed' : ''}</h3><p className="mt-3 text-sm leading-relaxed text-cosmic-100">{item.text}</p></article>)}</div>
          <p className="mt-5 leading-relaxed text-cosmic-200">The thread: ask for one observable change, choose a calmer moment, and separate what you know from what you assume. Use the reading as a starting point for your own reflection.</p>
        </section>
        <section id="purchase" className="mt-14 scroll-mt-8 rounded-2xl border border-gold/40 bg-cosmic-900/50 p-6 sm:p-8">
          <h2 className="font-serif text-3xl text-gold">Bring the question that keeps coming back.</h2>
          <p className="my-5 leading-relaxed text-cosmic-200">{product.formattedPrice} unlocks Relationship Dynamics. Create or sign in to your account, complete checkout, then enter your question. Your completed reading is saved in <a href="/tarot/history" className="underline">My readings</a>.</p>
          <RelationshipOfferActions />
        </section>
        <section className="mt-12 space-y-5 text-cosmic-200">
          <h2 className="font-serif text-2xl text-gold">Before you decide</h2>
          <p><strong>Want to try the experience free?</strong> <a href="/tarot" className="text-gold underline">Try One Card or Past · Present · Future</a>. You can return here whenever you want a relationship-focused spread.</p>
          <p><strong>Will this tell me what someone secretly feels?</strong> No. It offers symbolic perspectives, not access to another person’s thoughts or proof about their behavior.</p>
          <p><strong>Do I need a subscription or birth details?</strong> No subscription or birth chart is required for this purchase.</p>
          <p className="text-sm">For reflection and entertainment. Not therapy, a diagnosis, or a guaranteed prediction. For account or delivery help, <a href="/contact" className="underline">contact us</a>.</p>
        </section>
      </div>
    </main>
  );
}
