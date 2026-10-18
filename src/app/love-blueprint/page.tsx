import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';
import { REPORT_META } from '@/lib/reportEngine';

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: 'Love Blueprint | Cosmic Spirit Guide',
    description: 'A personalized relationship-focused astrology report built from your verified birth chart.',
    path: '/love-blueprint',
    type: 'website',
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Love Blueprint', path: '/love-blueprint' }]),
    ),
  });
  return metadata;
}

export default function LoveBlueprintPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Love Blueprint', path: '/love-blueprint' }]),
  );
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-cosmic-100">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-cosmic-300">
        <Link href="/">Home</Link> / <span>Love Blueprint</span>
      </nav>
      <p className="mt-10 text-xs uppercase tracking-[0.35em] text-gold">Personalized astrology report</p>
      <h1 className="mt-4 font-serif text-5xl text-white">Love Blueprint</h1>
      <p className="mt-6 text-lg leading-relaxed text-cosmic-200">See how your Venus, Mars, Moon, and relationship-axis signatures shape the way you connect, desire, protect yourself, and choose.</p>
      <ul className="mt-8 space-y-3 text-cosmic-200">
        <li>• Verified placements from your saved birth chart</li>
        <li>• Relationship-focused aspects and patterns</li>
        <li>• A cohesive narrative with practical reflection prompts</li>
        <li>• Downloadable report after purchase and server-side verification</li>
      </ul>
      <p className="mt-8 text-sm text-cosmic-300">One-time purchase: <span className="text-gold">${REPORT_META.loveblueprint.price}</span>. Checkout and access are handled from the existing reports flow.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/reports" className="rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wider text-cosmic-950">Continue to reports</Link>
        <Link href="/birth-chart" className="rounded-full border border-gold/50 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold">Create your chart first</Link>
      </div>
    </main>
  );
}
