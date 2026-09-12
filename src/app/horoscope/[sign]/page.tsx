import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { getSign } from "@/lib/astrology";
import { allSignKeys } from "@/lib/seo/programmatic";
import { isProgrammaticIndexed } from "@/lib/seo/programmatic-approval";

export const dynamicParams = false;

export function generateStaticParams() {
  return allSignKeys().map((s) => ({ sign: s }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sign: string }>;
}): Promise<Metadata> {
  const { sign: raw } = await params;
  const sign = getSign(raw);
  if (!sign) return { title: "Horoscope Not Found" };
  const title = sign.label + " Horoscope: Daily & Weekly Guidance | Cosmic Spirit Guide";
  const description =
    "Time-bound guidance for " + sign.label + " (" + sign.element + " sign ruled by " + sign.ruler +
    "): how the current sky colors your focus, mood, and choices. Anchor traits in your zodiac sign.";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/horoscope/" + sign.key,
    type: "website",
    noindex: !isProgrammaticIndexed("horoscope", sign.key, sign.key),
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Horoscope", path: "/horoscope" },
        { name: sign.label, path: "/horoscope/" + sign.key },
      ])
    ),
  });
  return metadata;
}

export default async function HoroscopeSignPage({
  params,
}: {
  params: Promise<{ sign: string }>;
}) {
  const { sign: raw } = await params;
  const sign = getSign(raw);
  if (!sign) notFound();
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Horoscope", path: "/horoscope" },
      { name: sign.label, path: "/horoscope/" + sign.key },
    ])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/horoscope">Horoscope</Link> / <span>{sign.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">{sign.label} Horoscope</h1>
      <p className="mt-3 text-lg">
        Your {sign.label} horoscope translates the current sky into a short, practical lens for the
        day: where to lean into your {sign.power.toLowerCase()} and where to pause. It is guidance,
        not fate.
      </p>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Anchor in your sign</h2>
        <p className="mt-2">
          {sign.label} is a {sign.element} {sign.modality.toLowerCase()} sign ruled by {sign.ruler}.
          Read the full reference on your <Link className="underline" href={"/zodiac/" + sign.key}>{sign.label} zodiac sign page</Link>.
        </p>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Daily and weekly forecasts are generated from real ephemeris once the transit engine is live.
        This page is the stable home for {sign.label} guidance.
      </p>
    </main>
  );
}
