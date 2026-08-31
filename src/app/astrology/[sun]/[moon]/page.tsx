import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import {
  organizationJsonLd,
  breadcrumbJsonLd,
  webApplicationJsonLd,
  mergeJsonLd,
} from "@/lib/seo/jsonld";
import { astrologyData, allSignKeys } from "@/lib/seo/programmatic";

export const dynamicParams = false;

export function generateStaticParams() {
  const keys = allSignKeys();
  const out: Array<{ sun: string; moon: string }> = [];
  for (const sun of keys) {
    for (const moon of keys) {
      out.push({ sun, moon });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sun: string; moon: string }>;
}): Promise<Metadata> {
  const { sun, moon } = await params;
  const data = astrologyData(sun, moon);
  if (!data) return { title: "Astrology Combination Not Found" };
  const title = data.sun.label + " Sun, " + data.moon.label + " Moon: Your Inner Blend";
  const description =
    "What a " + data.sun.element + " Sun (" + data.sun.modality + ") with a " +
    data.moon.element + " Moon (" + data.moon.modality + ") looks like: outer drive meets inner weather.";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/astrology/" + sun + "/" + moon,
    type: "website",
    noindex: true,
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Astrology", path: "/astrology" },
        { name: data.sun.label + " Sun / " + data.moon.label + " Moon", path: "/astrology/" + sun + "/" + moon },
      ]),
      webApplicationJsonLd({
        description: "Free natal Sun/Moon blend reading from Cosmic Spirit Guide.",
      }),
    ),
  });
  return metadata;
}

export default async function AstrologyComboPage({
  params,
}: {
  params: Promise<{ sun: string; moon: string }>;
}) {
  const { sun, moon } = await params;
  const data = astrologyData(sun, moon);
  if (!data) notFound();

  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Astrology", path: "/astrology" },
      { name: data.sun.label + " Sun / " + data.moon.label + " Moon", path: "/astrology/" + sun + "/" + moon },
    ]),
    webApplicationJsonLd({
      description: "Free natal Sun/Moon blend reading from Cosmic Spirit Guide.",
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/astrology">Astrology</Link> /{" "}
        <span>{data.sun.label} Sun, {data.moon.label} Moon</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">
        {data.sun.label} Sun, {data.moon.label} Moon
      </h1>
      <p className="mt-2 text-lg">
        Your Sun is the {data.sun.element} {data.sun.modality.toLowerCase()} self you show the world.
        Your Moon is the {data.moon.element} {data.moon.modality.toLowerCase()} inner weather that runs underneath.
      </p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">The {data.sun.label} Sun</h2>
        <p className="mt-2">{data.sun.explanation}</p>
      </section>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">The {data.moon.label} Moon</h2>
        <p className="mt-2">{data.moon.explanation}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">The blend</h2>
        <p className="mt-2">
          Ruled respectively by {data.sun.ruler} and {data.moon.ruler}, this combination pairs a
          {" "}{data.sun.element} outer drive with a {data.moon.element} inner life.
          {" "}{data.sun.modality} and {data.moon.modality} together set the tempo.
        </p>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        See your real chart: <Link className="underline" href="/birth-chart">free birth chart</Link>.
      </p>
    </main>
  );
}
