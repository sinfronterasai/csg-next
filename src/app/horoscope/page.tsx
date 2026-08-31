import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { SIGNS } from "@/lib/astrology";
import { allSignKeys } from "@/lib/seo/programmatic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Horoscope | Cosmic Spirit Guide",
    description:
      "Daily and weekly horoscope guidance for all twelve signs, anchored in each sign's real traits. Time-bound, practical, and linking back to your zodiac reference.",
    path: "/horoscope",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Horoscope", path: "/horoscope" }])
    ),
  });
  return metadata;
}

export default function HoroscopeHub() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Horoscope", path: "/horoscope" }])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Horoscope</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Horoscope</h1>
      <p className="mt-3 text-lg">
        Pick your sign for time-bound guidance. Each sign's horoscope links back to its evergreen
        zodiac reference so the daily lens stays grounded in who you are.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {allSignKeys().map((s) => {
          const sign = SIGNS.find((x) => x.key === s)!;
          return (
            <li key={s} className="rounded-lg border p-3">
              <Link className="underline" href={"/horoscope/" + s}>
                {sign.glyph} {sign.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
