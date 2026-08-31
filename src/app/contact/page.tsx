import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Contact Cosmic Spirit Guide",
    description:
      "Reach the Cosmic Spirit Guide team for support, corrections, data requests, or feedback.",
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
        We read every message. For the fastest help, use the in-app support form (the help icon in
        the header) or email us directly &mdash; both reach a monitored inbox.
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Support email</h2>
        <p className="mt-2">
          <a className="underline" href="mailto:support@cosmicspiritguide.com">
            support@cosmicspiritguide.com
          </a>{" "}
          &mdash; account, billing, and product questions. We aim to reply within two business days.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">Privacy and data requests</h2>
        <p className="mt-2">
          To access, correct, or delete your data, or to exercise any right under our{" "}
          <Link className="underline" href="/privacy">
            Privacy Policy
          </Link>
          , email{" "}
          <a className="underline" href="mailto:support@cosmicspiritguide.com">
            support@cosmicspiritguide.com
          </a>{" "}
          from the address on your account. We verify identity before making changes and respond
          within 30 days.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">What to include</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>Your account email (so we can find your record).</li>
          <li>The chart or report the message is about, if any.</li>
          <li>A clear description of the question or request.</li>
        </ul>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Cosmic Spirit Guide is operated by Sin Fronteras AI. This page is part of the live site.
      </p>
    </main>
  );
}
