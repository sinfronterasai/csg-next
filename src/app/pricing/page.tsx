import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Products & Pricing | Cosmic Spirit Guide",
    description:
      "Cosmic Spirit Guide products: the free Birth Chart for everyone, and the Love Blueprint available by invite during beta. Other premium reports are not yet offered.",
    path: "/pricing",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]),
    ],
  });
  return metadata;
}

export default function PricingPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]),
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
        <h2 className="text-xl font-medium">Love Blueprint</h2>
        <p className="mt-2">
          Available by invite during beta. Not yet publicly priced. Join the waitlist from your
          reports page to request access.
        </p>
        <Link className="mt-2 inline-block underline" href="/reports">Request access</Link>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Other premium reports shown in earlier designs are not offered in this interface yet. We will
        list them here only when they are live.
      </p>
    </main>
  );
}
