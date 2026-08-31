import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd, webApplicationJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { allSignKeys, signLabel, canonicalPair } from "@/lib/seo/programmatic";

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
  const examples = signs.slice(0, 6).map((a) => {
    const [ca, cb] = canonicalPair(a, "libra");
    return { ca, cb, label: signLabel(ca) + " and " + signLabel(cb) };
  });
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
        <h2 className="text-xl font-medium">Start with a sign</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {signs.map((s) => {
            const [ca, cb] = canonicalPair(s, s);
            return (
              <li key={s}>
                <Link className="rounded-full border px-3 py-1 text-sm" href={"/compatibility/" + ca + "-and-" + cb}>
                  {signLabel(s)} + {signLabel(s)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Example pairings</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {examples.map((e) => (
            <li key={e.ca + e.cb}>
              <Link className="rounded-full border px-3 py-1 text-sm" href={"/compatibility/" + e.ca + "-and-" + e.cb}>
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
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
