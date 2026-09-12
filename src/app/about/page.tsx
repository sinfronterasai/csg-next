import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "About Cosmic Spirit Guide",
    description:
      "Why Cosmic Spirit Guide builds free astrology tools from real ephemeris calculation, and how we keep tarot honest about what it is.",
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
        Cosmic Spirit Guide turns <strong>real astrological calculation</strong> into clear, free
        tools. Your birth chart, Sun and Moon signs, and compatibility are computed from astronomy
        &mdash; the actual positions of the planets at your moment of birth &mdash; not from a random
        generator that reshuffles each visit.
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Calculation, not chance</h2>
        <p className="mt-2">
          A birth chart is a snapshot of the sky. Given your birth date, time, and place, the math
          is deterministic: the same inputs always produce the same chart, because they describe a
          real event. We think that distinction matters. A tool that invents a chart teaches you
          nothing about yourself; a tool that calculates one gives you something you can actually
          sit with.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Tarot is different, and we say so</h2>
        <p className="mt-2">
          Tarot is not calculated. A card draw is an interpreted prompt, not an astronomical fact,
          and we are clear about that. Where astrology is computed, tarot is reflected on. Keeping
          that line honest &mdash; here is the math, there is the mirror &mdash; is the whole point
          of the companion.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">What you can do free</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <Link className="underline" href="/birth-chart">
              Generate your birth chart
            </Link>{" "}
            (full natal report).
          </li>
          <li>
            <Link className="underline" href="/zodiac">
              Explore the zodiac signs
            </Link>
            .
          </li>
          <li>
            <Link className="underline" href="/compatibility">
              Check love compatibility
            </Link>{" "}
            by sign.
          </li>
          <li>
            <Link className="underline" href="/tarot">
              Draw a tarot card
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">How we treat your data</h2>
        <p className="mt-2">
          We ask for birth details only to compute your chart, and we minimize how long the raw
          inputs are kept. Read the full <Link className="underline" href="/privacy">Privacy Policy</Link>{" "}
          for what we collect, who we share it with, and how to delete it. For anything else, the{" "}
          <Link className="underline" href="/contact">contact page</Link> reaches a human.
        </p>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Cosmic Spirit Guide is an AI-assisted astrology and tarot companion built on real
        astrological calculation, operated by Sin Fronteras AI.
      </p>
    </main>
  );
}
