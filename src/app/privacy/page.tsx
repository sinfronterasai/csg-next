import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Privacy Policy | Cosmic Spirit Guide",
    description: "How Cosmic Spirit Guide collects, uses, and protects your data.",
    path: "/privacy",
    noindex: true,
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
        Until then this page is a placeholder and is not indexed.
      </p>
    </main>
  );
}
