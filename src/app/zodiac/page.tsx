import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { allSignKeys, signLabel } from "@/lib/seo/programmatic";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "The 12 Zodiac Signs | Cosmic Spirit Guide",
    description:
      "Explore all twelve zodiac signs — their elements, modalities, and traits — and what each sign brings to your birth chart.",
    path: "/zodiac",
    type: "website",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Zodiac", path: "/zodiac" }]),
    ],
  });
  return metadata;
}

export default function ZodiacHub() {
  const signs = allSignKeys();
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Zodiac", path: "/zodiac" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Zodiac</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">The Twelve Zodiac Signs</h1>
      <p className="mt-3 text-lg">
        Each sign carries its own element, modality, and traits. Pick a sign to see what shapes its
        energy in a birth chart.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {signs.map((s) => (
          <li key={s}>
            <Link
              className="block rounded-lg border px-4 py-3 text-center font-medium"
              href={"/zodiac/" + s}
            >
              {signLabel(s)}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
