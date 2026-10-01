import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { getProduct } from "@/lib/productCatalog";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Services | Cosmic Spirit Guide",
    description:
      "Cosmic Spirit Guide services: free birth-chart computation, Premium Natal, Love Blueprint, Yearly Transit, Vocation & Wealth, and one-time Tarot readings.",
    path: "/services",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
    ],
  });
  return metadata;
}

export default function ServicesPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Services</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Services</h1>
      <p className="mt-3 text-lg">What you can do on Cosmic Spirit Guide today.</p>

      <ul className="mt-6 space-y-4">
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">Birth Chart</h2>
          <p className="mt-2">Compute your free natal chart from real ephemeris data.</p>
          <Link className="mt-2 inline-block underline" href="/birth-chart">Get started</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">Tarot</h2>
          <p className="mt-2">Draw and interpret tarot cards for reflection.</p>
          <Link className="mt-2 inline-block underline" href="/tarot">Read tarot</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">{getProduct('natalpremium').displayName} — {getProduct('natalpremium').formattedPrice}</h2>
          <p className="mt-2">A complete, quality-gated natal story with verified placements and a downloadable PDF. One-time purchase, yours forever. Available now.</p>
          <Link className="mt-2 inline-block underline" href="/reports">Get Premium Natal Report</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">{getProduct('loveblueprint').displayName} — {getProduct('loveblueprint').formattedPrice}</h2>
          <p className="mt-2">
            Your Venus, Mars and Moon signature with the real love aspects colouring your chart.
            One-time purchase, yours forever. Available now.
          </p>
          <Link className="mt-2 inline-block underline" href="/reports">Get Love Blueprint</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">{getProduct('transit').displayName} — {getProduct('transit').formattedPrice}</h2>
          <p className="mt-2">A deterministic twelve-month map of your strongest transit windows, exact hits, eclipses, and practical timing. One-time purchase, yours forever. Available now.</p>
          <Link className="mt-2 inline-block underline" href="/reports">Get Yearly Transit Forecast</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">{getProduct('vocation').displayName} — {getProduct('vocation').formattedPrice}</h2>
          <p className="mt-2">A deterministic 24-month professional timing map for your public role, work, money patterns, and next launch windows. One-time purchase, yours forever. Available now.</p>
          <Link className="mt-2 inline-block underline" href="/reports">Get Vocation &amp; Wealth Map</Link>
        </li>
      </ul>
    </main>
  );
}
