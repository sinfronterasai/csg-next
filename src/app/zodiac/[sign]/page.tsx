import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import {
  organizationJsonLd,
  breadcrumbJsonLd,
  webApplicationJsonLd,
  mergeJsonLd,
} from "@/lib/seo/jsonld";
import { zodiacData, signEvidenceRows, signLabel, allSignKeys } from "@/lib/seo/programmatic";

export const dynamicParams = false;

export function generateStaticParams() {
  return allSignKeys().map((sign) => ({ sign }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sign: string }>;
}): Promise<Metadata> {
  const { sign } = await params;
  const data = zodiacData(sign);
  if (!data) return { title: "Zodiac Sign Not Found | Cosmic Spirit Guide" };
  const label = data.sign.label;
  const s = data.sign;
  const title = label + " Zodiac Sign: Element, Ruler, Dates and Traits";
  const description =
    "What defines " + label + " (" + s.dates + "): a " + s.element + " " + s.modality.toLowerCase() +
    " sign ruled by " + s.ruler + ". Core power: " + s.power + ".";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/zodiac/" + sign,
    type: "website",
    jsonLd: mergeSchemas(label, sign),
  });
  return metadata;
}

function mergeSchemas(label: string, signKey: string) {
  return mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Zodiac Signs", path: "/zodiac" },
      { name: label, path: "/zodiac/" + signKey },
    ]),
    webApplicationJsonLd({
      description: "Free birth-chart and zodiac tools from Cosmic Spirit Guide.",
    }),
  );
}

export default async function ZodiacSignPage({
  params,
}: {
  params: Promise<{ sign: string }>;
}) {
  const { sign } = await params;
  const data = zodiacData(sign);
  if (!data) notFound();
  const { sign: s } = data;

  const jsonLd = mergeSchemas(s.label, sign);
  const rows = signEvidenceRows(s);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/zodiac">Zodiac Signs</Link> / <span>{s.label}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">{s.label} Zodiac Sign</h1>
      <p className="mt-2 text-lg">{s.explanation}</p>

      <section aria-label="At a glance" className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">At a glance</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b py-1">
              <dt className="font-medium">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">What {s.label} is really like</h2>
        <p className="mt-2">{s.traits}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Most compatible with {s.label}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {data.compatible.map((c) => (
            <li key={c.key}>
              <Link
                className="rounded-full border px-3 py-1 text-sm"
                href={"/compatibility/" + s.key + "-and-" + c.key}
              >
                {s.label} + {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {data.opposite ? (
        <section className="mt-6">
          <h2 className="text-xl font-medium">Opposite sign</h2>
          <p className="mt-2">
            {s.label} sits opposite{" "}
            <Link className="underline" href={"/zodiac/" + data.opposite.key}>
              {data.opposite.label}
            </Link>{" "}
            ({data.opposite.element} {data.opposite.modality.toLowerCase()}).
          </p>
        </section>
      ) : null}
    </main>
  );
}
