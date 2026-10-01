import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { organizationJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';
import { getProduct } from '@/lib/productCatalog';

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: 'Products & Pricing | Cosmic Spirit Guide',
    description:
      'Cosmic Spirit Guide products: a free Birth Chart plus Premium Natal, Love Blueprint, Yearly Transit, and Vocation & Wealth reports. Tarot spreads are available separately as one-time purchases.',
    path: '/pricing',
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]),
    ],
  });
  return metadata;
}

export default function PricingPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Pricing</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Products &amp; Pricing</h1>
      <p className="mt-3 text-lg">
        We keep our product list honest. Here is exactly what is available today.
      </p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Free Birth Chart</h2>
        <p className="mt-2">Free for all visitors. Computed from your birth date, time, and place.</p>
        <Link className="mt-2 inline-block underline" href="/birth-chart">Open your free chart</Link>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">{getProduct('natalpremium').displayName} — {getProduct('natalpremium').formattedPrice}</h2>
        <p className="mt-2">A complete, quality-gated natal story with verified placements and a downloadable PDF. One-time purchase, yours forever. Available now.</p>
        <Link className="mt-2 inline-block underline" href="/reports">Get Premium Natal Report</Link>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">{getProduct('loveblueprint').displayName} — {getProduct('loveblueprint').formattedPrice}</h2>
        <p className="mt-2">
          Your Venus, Mars and Moon signature with the real love aspects colouring your chart.
          One-time purchase, yours forever. Available now.
        </p>
        <Link className="mt-2 inline-block underline" href="/reports">Get Love Blueprint</Link>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">{getProduct('transit').displayName} — {getProduct('transit').formattedPrice}</h2>
        <p className="mt-2">A deterministic twelve-month map of your strongest transit windows, exact hits, eclipses, and practical timing. One-time purchase, yours forever. Available now.</p>
        <Link className="mt-2 inline-block underline" href="/reports">Get Yearly Transit Forecast</Link>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">{getProduct('vocation').displayName} — {getProduct('vocation').formattedPrice}</h2>
        <p className="mt-2">A deterministic 24-month professional timing map for your public role, work, money patterns, and next launch windows. One-time purchase, yours forever. Available now.</p>
        <Link className="mt-2 inline-block underline" href="/reports">Get Vocation &amp; Wealth Map</Link>
      </section>
    </main>
  );
}
