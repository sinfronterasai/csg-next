import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Terms of Use | Cosmic Spirit Guide",
    description:
      "The terms governing your use of Cosmic Spirit Guide, including our entertainment disclaimer and purchase terms.",
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
      <p className="mt-1 text-sm text-muted-foreground">Last updated: 31 August 2026</p>

      <section className="mt-6">
        <h2 className="text-xl font-medium">1. Acceptance</h2>
        <p className="mt-2">
          By using Cosmic Spirit Guide you agree to these terms. If you do not agree, do not use the
          service.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">2. Nature of the service</h2>
        <p className="mt-2">
          Cosmic Spirit Guide provides astrology and tarot tools for personal insight and
          self-reflection. Readings, charts, and reports are for{" "}
          <strong>entertainment and self-reflection</strong> and are not professional, medical,
          financial, legal, or psychological advice. Do not use them to make decisions about your
          health, finances, or wellbeing &mdash; consult a qualified professional instead.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">3. Accounts</h2>
        <p className="mt-2">
          You are responsible for the accuracy of the birth details you enter and for keeping your
          account credentials confidential. You must be at least 16 years old to create an account.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">4. Products and purchases</h2>
        <p className="mt-2">
          The <strong>free Natal chart</strong> is available to every visitor. The{" "}
          <strong>Love Blueprint</strong> is a one-time $39 purchase. Other premium reports are
          introduced over time and shown on the site; the catalog may change.
        </p>
        <p className="mt-2">
          <strong>Payments.</strong> Charges are processed by a PCI-compliant payment processor.
          Prices and currency are shown before you confirm a purchase.
        </p>
        <p className="mt-2">
          <strong>Refunds.</strong> Because reports are personalized digital goods generated on
          demand, they are generally non-refundable once produced. If a report fails to generate or
          is materially defective, contact{" "}
          <a className="underline" href="mailto:support@cosmicspiritguide.com">
            support@cosmicspiritguide.com
          </a>{" "}
          and we will re-issue or refund at our discretion. Recurring or subscription charges can be
          cancelled at any time from your account.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">5. Acceptable use</h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Use the service for unlawful, harassing, or harmful purposes.</li>
          <li>Attempt to reverse-engineer, scrape, or overload the service.</li>
          <li>Impersonate others or misrepresent your identity.</li>
          <li>Rely on the service as a substitute for professional advice.</li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">6. Intellectual property</h2>
        <p className="mt-2">
          The software, design, and written content are owned by Cosmic Spirit Guide or its
          licensors. Generated charts and reports are provided for your personal use; you may not
          resell or redistribute them.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">7. Disclaimer and limitation of liability</h2>
        <p className="mt-2">
          The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
          extent permitted by law, Cosmic Spirit Guide is not liable for any indirect or consequential
          loss arising from your use of the service.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-medium">8. Changes</h2>
        <p className="mt-2">
          We may update these terms; material changes are posted here with a new &ldquo;Last
          updated&rdquo; date. Continued use after a change constitutes acceptance.
        </p>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Questions about these terms? Email{" "}
        <a className="underline" href="mailto:support@cosmicspiritguide.com">
          support@cosmicspiritguide.com
        </a>
        .
      </p>
    </main>
  );
}
