import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Privacy Policy | Cosmic Spirit Guide",
    description: "How Cosmic Spirit Guide collects, uses, and protects your data.",
    path: "/privacy",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }]),
    ],
  });
  return metadata;
}

export default function PrivacyPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Privacy</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-3 text-lg">
        We are preparing a complete privacy policy with verified business and data-handling details.
        The summary below is published while the full policy is finalized; it will be replaced with
        the complete document before launch.
      </p>
      <section className="mt-6">
        <h2 className="text-xl font-medium">Data we use</h2>
        <p className="mt-2">
          Birth details you enter (date, time, place) are used only to compute your chart. We do not
          sell or share them. Full retention and processor details will be stated in the finalized policy.
        </p>
      </section>
    </main>
  );
}
