import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd, webApplicationJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { allSignKeys, signLabel } from "@/lib/seo/programmatic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Love Compatibility by Zodiac Sign | Cosmic Spirit Guide",
    description:
      "How any two zodiac signs connect: element and modality mixes, shared traits, and where friction shows up. Explore all sign pairs.",
    path: "/compatibility",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Compatibility", path: "/compatibility" }]),
      webApplicationJsonLd({ description: "Free love-compatibility reading from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function CompatibilityHub() {
  const signs = allSignKeys();
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Compatibility", path: "/compatibility" }])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Compatibility</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Love Compatibility</h1>
      <p className="mt-3 text-lg">
        Compatibility looks at how two signs' elements and modalities interact — where they reinforce
        each other and where they challenge each other. Pick any two signs to see the blend.
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">How compatibility works here</h2>
        <p className="mt-2 text-muted-foreground">
          Pair pages are being prepared with editorially approved, pair-specific dynamics. Until then,
          build your free birth chart to ground any compatibility read in your real placements.
        </p>
      </section>

      <section className="mt-6">
        <Link className="underline" href="/birth-chart">
          Build your birth chart
        </Link>{" "}
        to ground a compatibility read in real placements.
      </section>
    </main>
  );
}
