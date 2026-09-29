import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import NamedTransitExplorer from "./NamedTransitExplorer";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Your Next Major Transit | Cosmic Spirit Guide",
    description:
      "Discover the next major planetary transit to your birth chart and when it is strongest.",
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
      <h1 className="mt-4 text-3xl font-semibold">YOUR NEXT MAJOR TRANSIT</h1>
      <p className="mt-3 text-lg">Discover the next major planetary transit to your birth chart and when it is strongest.</p>
      <p className="mt-6 text-sm text-muted-foreground">Use your birth date, time, and location to find your next meaningful sky-to-chart connection.</p>
      <NamedTransitExplorer />
    </main>
  );
}
