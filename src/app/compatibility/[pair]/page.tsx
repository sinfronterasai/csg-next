import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import {
  organizationJsonLd,
  breadcrumbJsonLd,
  webApplicationJsonLd,
  mergeJsonLd,
} from "@/lib/seo/jsonld";
import {
  compatibilityData,
  canonicalPair,
  signLabel,
  allSignKeys,
} from "@/lib/seo/programmatic";
import { isProgrammaticIndexed } from "@/lib/seo/programmatic-approval";

export const dynamicParams = false;

export function generateStaticParams() {
  const keys = allSignKeys();
  const out: Array<{ pair: string }> = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = canonicalPair(keys[i], keys[j]);
      out.push({ pair: a + "-and-" + b });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair: slug } = await params;
  const parts = slug.split("-and-");
  if (parts.length !== 2) return { title: "Compatibility Not Found" };
  const data = compatibilityData(parts[0], parts[1]);
  if (!data) return { title: "Compatibility Not Found" };
  const label = data.a.label + " and " + data.b.label;
  const title = label + " Love Compatibility: How Your Signs Connect";
  const description =
    "Love compatibility between " + data.a.label + " (" + data.a.element + ") and " +
    data.b.label + " (" + data.b.element + "): element mix " + data.elementMix +
    ", modality mix " + data.modalityMix + ".";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/compatibility/" + slug,
    type: "website",
    noindex: !isProgrammaticIndexed("compatibility", parts[0], parts[1]),
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Compatibility", path: "/compatibility" },
        { name: label, path: "/compatibility/" + slug },
      ]),
      webApplicationJsonLd({
        description: "Free love-compatibility reading from Cosmic Spirit Guide.",
      }),
    ),
  });
  return metadata;
}

export default async function CompatibilityPage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair: slug } = await params;
  const parts = slug.split("-and-");
  if (parts.length !== 2) return null;
  const data = compatibilityData(parts[0], parts[1]);
  if (!data) return null;
  const canonicalSlug = data.canonical.replace("/compatibility/", "");
  if (slug !== canonicalSlug) redirect("/compatibility/" + canonicalSlug);

  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Compatibility", path: "/compatibility" },
      { name: data.a.label + " and " + data.b.label, path: "/compatibility/" + slug },
    ]),
    webApplicationJsonLd({
      description: "Free love-compatibility reading from Cosmic Spirit Guide.",
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/compatibility">Compatibility</Link> /{" "}
        <span>{data.a.label} and {data.b.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">
        {data.a.label} and {data.b.label} Love Compatibility
      </h1>
      <p className="mt-2 text-lg">
        {data.a.label} is a {data.a.element} {data.a.modality.toLowerCase()} sign ruled by {data.a.ruler}.
        {" "}{data.b.label} is a {data.b.element} {data.b.modality.toLowerCase()} sign ruled by {data.b.ruler}.
      </p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Element mix: {data.elementMix}</h2>
        <p className="mt-2">
          {data.sharedElement
            ? "You share an element, which gives you a natural common language."
            : "You bridge two different elements, which can be complementary or require translation."}
        </p>
      </section>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Modality mix: {data.modalityMix}</h2>
        <p className="mt-2">
          {data.sharedModality
            ? "Shared modality means you move through life at a similar pace."
            : "Different modalities mean one of you initiates while the other sustains or adapts."}
        </p>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        For a full picture, build your <Link className="underline" href="/birth-chart">free birth chart</Link>.
      </p>
    </main>
  );
}
