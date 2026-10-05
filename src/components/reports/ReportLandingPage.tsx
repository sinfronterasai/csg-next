'use client';

import Link from 'next/link';
import type { ReportLandingContent, LandingProductType } from '@/lib/reportLandingPages';

interface ReportLandingPageProps {
  content: ReportLandingContent;
  price: number;
}

function ProductCta({ type, price, label }: { type: LandingProductType; price: number; label: string }) {
  return (
    <Link
      href={`/reports?product=${encodeURIComponent(type)}`}
      data-product-type={type}
      data-cta="report-checkout"
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-400 px-7 py-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-cosmic-950 shadow-[0_0_24px_rgba(223,183,108,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(223,183,108,0.42)] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-cosmic-950"
    >
      {label} — ${price}
    </Link>
  );
}

export default function ReportLandingPage({ content, price }: ReportLandingPageProps) {
  return (
    <main className="relative z-10 overflow-hidden">
      <section className="constellation-map px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <Link href="/reports" className="text-xs uppercase tracking-[0.25em] text-cosmic-300 transition hover:text-gold">
              ← Compare all reports
            </Link>
            <p className="mt-8 text-xs uppercase tracking-[0.35em] text-gold">{content.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-tight text-white sm:text-6xl">{content.headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-cosmic-200">{content.summary}</p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <ProductCta type={content.type} price={price} label={`Choose ${content.name}`} />
              <span className="text-sm text-cosmic-300">One-time purchase · secure Whop checkout</span>
            </div>
          </div>
          <div className="glass-panel glow-border rounded-[2rem] border border-gold/30 p-7 sm:p-9">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">{content.name}</p>
            <div className="mt-5 flex items-end gap-3">
              <span className="font-serif text-5xl text-white">${price}</span>
              <span className="pb-2 text-sm text-cosmic-300">one time</span>
            </div>
            <div className="mt-7 space-y-4 border-t border-white/10 pt-6 text-sm leading-6 text-cosmic-200">
              <p><span className="text-gold">Account:</span> sign in or create one before checkout.</p>
              <p><span className="text-gold">Chart:</span> uses the saved birth chart in your profile.</p>
              <p><span className="text-gold">Retrieval:</span> Profile → Reports after approval.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
        <div className="glass-panel rounded-3xl p-7 sm:p-9">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">Inside the report</p>
          <h2 className="mt-3 font-serif text-3xl text-white">What you receive</h2>
          <ul className="mt-7 space-y-4 text-cosmic-200">
            {content.includes.map((item) => <li key={item} className="flex gap-3"><span className="text-gold">✦</span><span>{item}</span></li>)}
          </ul>
        </div>
        <div className="glass-panel rounded-3xl p-7 sm:p-9">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">A good fit if</p>
          <h2 className="mt-3 font-serif text-3xl text-white">Who this is for</h2>
          <ul className="mt-7 space-y-4 text-cosmic-200">
            {content.audience.map((item) => <li key={item} className="flex gap-3"><span className="text-gold">✦</span><span>{item}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-9">
          <p className="text-xs uppercase tracking-[0.25em] text-gold">How the existing flow works</p>
          <div className="mt-7 grid gap-5 md:grid-cols-4">
            {content.steps.map((step, index) => (
              <div key={step} className="border-t border-gold/30 pt-4">
                <span className="font-serif text-2xl text-gold">0{index + 1}</span>
                <p className="mt-3 text-sm leading-6 text-cosmic-200">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div className="glass-panel rounded-3xl p-7 sm:p-9">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Before you buy</p>
            <h2 className="mt-3 font-serif text-3xl text-white">Birth-time limits</h2>
            <p className="mt-6 leading-7 text-cosmic-200">{content.birthTimeNote}</p>
            <div className="mt-7 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-gold">Plain limits</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-cosmic-300">
                {content.limitations.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
          <div className="glass-panel rounded-3xl p-7 sm:p-9">
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Questions</p>
            <h2 className="mt-3 font-serif text-3xl text-white">FAQ</h2>
            <div className="mt-6 space-y-6">
              {content.faqs.map((faq) => (
                <div key={faq.question} className="border-b border-white/10 pb-5 last:border-0 last:pb-0">
                  <h3 className="font-serif text-lg text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-cosmic-300">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 text-center">
        <h2 className="font-serif text-3xl text-white sm:text-4xl">Ready to explore {content.name}?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-cosmic-300">Your purchase stays attached to the selected report through sign-in, chart setup, checkout, and delivery.</p>
        <div className="mt-7"><ProductCta type={content.type} price={price} label={`Continue with ${content.name}`} /></div>
        <p className="mt-5 text-sm text-cosmic-400">Need a different report? <Link href="/reports" className="text-gold underline underline-offset-4">Return to comparison</Link>.</p>
      </section>
    </main>
  );
}
