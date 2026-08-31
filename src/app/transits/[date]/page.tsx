import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { isProgrammaticIndexed } from "@/lib/seo/programmatic-approval";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const title = "Transits for " + date + " | Cosmic Spirit Guide";
  const description =
    "How the moving planets color " + date + ": what each transit means and how to work with it. Real ephemeris interpretation, not generic filler.";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/transits/" + date,
    type: "website",
    noindex: !isProgrammaticIndexed("transits", date, date),
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Transits", path: "/transits" },
        { name: date, path: "/transits/" + date },
      ])
    ),
  });
  return metadata;
}

export default async function TransitDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Transits", path: "/transits" },
      { name: date, path: "/transits/" + date },
    ])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/transits">Transits</Link> / <span>{date}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Transits for {date}</h1>
      <p className="mt-3 text-lg">
        A transit is a planet's current position measured against the backdrop of the zodiac. When a
        planet moves through a sign or touches a point in your chart, it colors the themes of that
        area for a window of time.
      </p>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">How to read this page</h2>
        <p className="mt-2">
          Once the nightly ephemeris batch is live, this page will show the real planet positions for
          {date} and a plain-language interpretation of each. Until then it is the stable home for the
          date.
        </p>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Build your <Link className="underline" href="/birth-chart">free birth chart</Link> to see how
        transits land on your own planets.
      </p>
    </main>
  );
}
