import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "About Cosmic Spirit Guide",
    description:
      "Cosmic Spirit Guide turns real astrological calculation into clear, free tools: your birth chart, zodiac, compatibility, and tarot.",
    path: "/about",
    jsonLd: [
      organizationJsonLd(),
      websiteJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
    ],
  });
  return metadata;
}

export default function AboutPage() {
  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>About</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">About Cosmic Spirit Guide</h1>
      <p className="mt-3 text-lg">
        Cosmic Spirit Guide builds free astrology tools from real ephemeris calculation — your
        birth chart, Sun and Moon signs, and compatibility are computed from astronomy, not random
        generators. Tarot is different: each card draw is interpreted, not calculated, and we’re
        clear about that distinction.
      </p>
      <section className="mt-6">
        <h2 className="text-xl font-medium">What you can do free</h2>
        <ul className="mt-2 list-disc pl-5">
          <li><Link className="underline" href="/birth-chart">Generate your birth chart</Link> (natal report).</li>
          <li><Link className="underline" href="/zodiac">Explore the zodiac signs</Link>.</li>
          <li><Link className="underline" href="/compatibility">Check love compatibility</Link> by sign.</li>
          <li><Link className="underline" href="/tarot">Draw a tarot card</Link>.</li>
        </ul>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Cosmic Spirit Guide is an AI-assisted astrology and tarot companion built on real
        astrological calculation.
      </p>
    </main>
  );
}
