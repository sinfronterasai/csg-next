import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd, webApplicationJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { allSignKeys, signLabel } from "@/lib/seo/programmatic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Astrology: Sun, Moon, Signs and Your Birth Chart | Cosmic Spirit Guide",
    description:
      "Explore astrology through your Sun and Moon signs, the twelve zodiac signs, and your free birth chart. Deterministic, data-backed sign insights.",
    path: "/astrology",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Astrology", path: "/astrology" }]),
      webApplicationJsonLd({ description: "Free birth-chart and zodiac tools from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function AstrologyHub() {
  const signs = allSignKeys();
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Astrology", path: "/astrology" }])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Astrology</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Astrology</h1>
      <p className="mt-3 text-lg">
        Astrology reads the sky at your moment of birth to map personality, drives, and relationship
        patterns. Start with your free birth chart, then explore the twelve signs and how your Sun and
        Moon combine.
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Your tools</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <Link className="underline" href="/birth-chart">
              Free Birth Chart
            </Link>{" "}
            — your Sun, Moon, Ascendant and house map.
          </li>
          <li>
            <Link className="underline" href="/compatibility">
              Compatibility
            </Link>{" "}
            — how two signs connect.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">The twelve zodiac signs</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {signs.map((s) => (
            <li key={s}>
              <Link className="rounded-full border px-3 py-1 text-sm" href={"/zodiac/" + s}>
                {signLabel(s)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Sun and Moon combinations</h2>
        <p className="mt-2">
          Every Sun sign paired with every Moon sign produces a distinct inner blend. Browse a starting
          example:
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {signs.slice(0, 4).map((s) => (
            <li key={s}>
              <Link className="rounded-full border px-3 py-1 text-sm" href={"/astrology/" + s + "/" + s}>
                {signLabel(s)} Sun, {signLabel(s)} Moon
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
