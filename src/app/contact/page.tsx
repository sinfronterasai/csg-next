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
        Questions or feedback? Email us at support@cosmicspiritguide.com.
      </p>
      <p className="mt-4">
        For data requests, see our <Link className="underline" href="/privacy">privacy policy</Link>.
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        [VERIFY: published contact email and any support-hours note before launch.]
      </p>
    </main>
  );
}
