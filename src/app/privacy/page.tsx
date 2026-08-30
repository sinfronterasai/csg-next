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
      <p className="mt-3 text-sm text-muted-foreground">Last updated: [VERIFY DATE]</p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">What we collect</h2>
        <p className="mt-2">
          To generate your birth chart we ask for birth date, time, and place. We store this only as
          needed to deliver your report. [VERIFY: confirm whether we store raw birth data or only derived chart data.]
        </p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-medium">Your rights</h2>
        <p className="mt-2">
          You can request access to or deletion of your data by emailing privacy@cosmicspiritguide.com.
          [VERIFY: jurisdiction-specific rights (GDPR/CCPA) before publishing.]
        </p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-medium">Third parties</h2>
        <p className="mt-2">
          [VERIFY: list any processors (payments, hosting) and their roles. Do not name processors we do not use.]
        </p>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        This page is a draft. No legal assurances are made until reviewed by the site owner.
      </p>
    </main>
  );
}
