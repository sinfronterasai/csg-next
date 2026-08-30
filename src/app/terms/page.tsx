import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Terms of Use | Cosmic Spirit Guide",
    description: "The terms that govern your use of Cosmic Spirit Guide.",
    path: "/terms",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Terms", path: "/terms" }]),
    ],
  });
  return metadata;
}

export default function TermsPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Terms", path: "/terms" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Terms</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Terms of Use</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: [VERIFY DATE]</p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Use of the service</h2>
        <p className="mt-2">
          Cosmic Spirit Guide provides astrology and tarot tools for personal insight. Readings are
          for entertainment and self-reflection, not professional, medical, financial, or legal advice.
        </p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-medium">Products</h2>
        <p className="mt-2">
          The free Natal chart is available to all visitors. The Love Blueprint is available by
          invite during beta. Other premium reports are not yet offered in this interface.
          [VERIFY: keep this list aligned with the live launch allowlist before publishing.]
        </p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-medium">Changes</h2>
        <p className="mt-2">[VERIFY: state how users are notified of changes.]</p>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        This page is a draft. No legal terms are binding until reviewed by the site owner.
      </p>
    </main>
  );
}
