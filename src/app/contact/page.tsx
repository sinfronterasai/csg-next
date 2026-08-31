import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Contact Cosmic Spirit Guide",
    description: "How to reach the Cosmic Spirit Guide team with questions or feedback.",
    path: "/contact",
    noindex: true,
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]),
    ],
  });
  return metadata;
}

export default function ContactPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Contact</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Contact</h1>
      <p className="mt-3 text-lg">
        Contact details will be published here once verified business information is available.
        This page is not indexed until then.
      </p>
    </main>
  );
}
