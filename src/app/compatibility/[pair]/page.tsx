import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { isProgrammaticApproved } from "@/lib/seo/programmatic-approval";

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
  // Fail-closed: unapproved pairs are unavailable (404), so no public metadata.
  if (!isProgrammaticApproved("compatibility", parts[0], parts[1])) {
    return { title: "Not Found" };
  }
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
    noindex: true,
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
  if (parts.length !== 2) notFound();
  // Fail-closed: no approved content => unavailable to public users (404).
  if (!isProgrammaticApproved("compatibility", parts[0], parts[1])) notFound();
  const data = compatibilityData(parts[0], parts[1]);
  if (!data) notFound();
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
        A {data.a.modality} {data.a.element} sign meeting a {data.b.modality} {data.b.element} sign.
        Element mix: {data.elementMix}. Modality mix: {data.modalityMix}.
      </p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">How {data.a.label} shows up</h2>
        <p className="mt-2">{data.a.traits}</p>
      </section>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">How {data.b.label} shows up</h2>
        <p className="mt-2">{data.b.traits}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Where the two connect</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>
            {data.sharedElement
              ? "You share an element (" + data.a.element + "), so you speak the same language."
              : "Different elements (" + data.elementMix + ") - contrast plus complement."}
          </li>
          <li>
            {data.sharedModality
              ? "Same modality (" + data.a.modality + ") means a similar pace and rhythm."
              : "Different modalities (" + data.modalityMix + ") - one initiates, one sustains or adapts."}
          </li>
          <li>
            {data.a.label} is ruled by {data.a.ruler}; {data.b.label} by {data.b.ruler}.
          </li>
        </ul>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Want the full synastry? Generate your{" "}
        <Link className="underline" href="/birth-chart">free birth chart</Link>.
      </p>
    </main>
  );
}
