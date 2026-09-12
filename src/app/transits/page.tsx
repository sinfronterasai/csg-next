import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Transits | Cosmic Spirit Guide",
    description:
      "Understand astrological transits: how the moving planets color your days, and what each transit means in plain language. Real ephemeris, updated nightly.",
    path: "/transits",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transits", path: "/transits" }])
    ),
  });
  return metadata;
}

export default function TransitsHub() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Transits", path: "/transits" }])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Transits</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Transits</h1>
      <p className="mt-3 text-lg">
        Transits are the moving planets, measured against the zodiac and against your birth chart.
        This hub explains how to read them; dated pages carry the real positions once the nightly
        batch is live.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        Get your <Link className="underline" href="/birth-chart">free birth chart</Link> to see where
        transits land for you.
      </p>
    </main>
  );
}
