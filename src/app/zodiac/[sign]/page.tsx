import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { SIGNS, getSign, type SignKey } from "@/lib/astrology";
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
  if (!sign) return { title: "Zodiac Sign Not Found" };
  const title = sign.label + " Zodiac Sign: Traits, Element & Ruling Planet | Cosmic Spirit Guide";
  const description =
    sign.label + " is a " + sign.element + " " + sign.modality.toLowerCase() + " sign ruled by " +
    sign.ruler + " (" + sign.dates + "). Explore its traits, compatibility, and meaning.";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/zodiac/" + sign.key,
    type: "website",
    noindex: !isProgrammaticIndexed("zodiac", sign.key, sign.key),
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Zodiac", path: "/zodiac" },
        { name: sign.label, path: "/zodiac/" + sign.key },
      ])
    ),
  });
  return metadata;
}

export default async function ZodiacSignPage({
  params,
}: {
  params: Promise<{ sign: string }>;
}) {
  const { sign: raw } = await params;
  const sign = getSign(raw);
  if (!sign) return null;
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Zodiac", path: "/zodiac" },
      { name: sign.label, path: "/zodiac/" + sign.key },
    ])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/zodiac">Zodiac</Link> / <span>{sign.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">
        {sign.glyph} {sign.label}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {sign.element} {sign.modality} sign · Ruled by {sign.ruler} · {sign.dates}
      </p>
      <p className="mt-3 text-lg">{sign.explanation}</p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Key traits</h2>
        <ul className="mt-2 list-disc pl-5">
          {sign.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">In relationships</h2>
        <p className="mt-2">{sign.label} pairs well with {sign.love}.</p>
        <p className="mt-2">
          For time-bound guidance, see your <Link className="underline" href={"/horoscope/" + sign.key}>daily {sign.label} horoscope</Link>.
        </p>
      </section>
    </main>
  );
}
