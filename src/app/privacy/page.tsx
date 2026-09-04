import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Privacy Policy | Cosmic Spirit Guide",
    description:
      "How Cosmic Spirit Guide collects, computes with, stores, and protects your birth data and account information.",
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
      <p className="mt-1 text-sm text-muted-foreground">Last updated: 31 August 2026</p>

      <p className="mt-4">
        Cosmic Spirit Guide (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an astrology and tarot
        companion operated by Sin Fronteras AI. This policy explains what we collect, why, how we
        protect it, and the choices you have. If you have questions, contact us at{" "}
        <a className="underline" href="mailto:support@cosmicspiritguide.com">
          support@cosmicspiritguide.com
        </a>
        .
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-medium">1. What we collect</h2>
        <p className="mt-2">
          To generate your chart we ask for <strong>birth date, birth time, and birth place</strong>{" "}
          (city and country). These three inputs are what an ephemeris calculation needs to place
          the planets at your moment of birth. Without an accurate time and place the chart is
          incomplete, so we request them honestly rather than guessing.
        </p>
        <p className="mt-2">We also process:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Account data you choose to create (email, optional display name).</li>
          <li>Payment data, handled by our payment processor &mdash; we do not store full card numbers.</li>
          <li>Support messages and the email address you send them from.</li>
          <li>Anonymous usage analytics (pages viewed, approximate region) to improve the site.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">2. How your birth data is used and computed</h2>
        <p className="mt-2">
          Your birth inputs are used to compute your chart and any reports you request. The
          calculation is performed against astronomical ephemeris data &mdash; it is not a random
          generator. Birth inputs are processed to produce your result and are then reduced to what
          the service needs to operate.
        </p>
        <p className="mt-2">
          <strong>Recovery records.</strong> In line with our data-minimization rule, private
          recovery and backup records do <strong>not</strong> retain the raw birth payload. We keep
          enough to let you return to a saved chart, not a warehouse of unprocessed birth details.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">3. Storage and retention</h2>
        <p className="mt-2">
          Data is stored in a managed database with encryption at rest. We retain account and chart
          data for as long as your account is active, and for a short grace period after deletion so
          you can recover a mistake. Payment records are retained only as long as required by tax and
          accounting law. Anonymous analytics are retained in aggregate form.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">4. Who we share data with</h2>
        <p className="mt-2">
          We do not sell your personal data. We share it only with vetted processors acting on our
          behalf, under contract:
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <strong>Hosting &amp; database</strong> provider that runs the application.
          </li>
          <li>
            <strong>Analytics</strong> provider for anonymous, aggregated usage measurement.
          </li>
          <li>
            <strong>Email</strong> provider for account and support messages.
          </li>
          <li>
            <strong>Payment</strong> processor (PCI-DSS compliant) that tokenizes card data; we never
            see or store the full card number.
          </li>
        </ul>
        <p className="mt-2">
          We may disclose data where required by law or to protect the rights, safety, and security
          of users and the service.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">5. International transfers</h2>
        <p className="mt-2">
          Our infrastructure and processors may be located outside your country of residence. Where
          data is transferred across borders we rely on our providers&rsquo; standard contractual and
          technical safeguards.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">6. Your rights</h2>
        <p className="mt-2">Depending on your jurisdiction, you can:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Request deletion of your account and associated birth/chart data.</li>
          <li>Object to or limit certain processing, and withdraw consent where processing is based on it.</li>
          <li>Receive a portable copy of your data.</li>
        </ul>
        <p className="mt-2">
          To exercise any of these, email{" "}
          <a className="underline" href="mailto:support@cosmicspiritguide.com">
            support@cosmicspiritguide.com
          </a>
          . We respond within 30 days and will verify your identity before making changes.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">7. Cookies and analytics</h2>
        <p className="mt-2">
          We use essential cookies to keep you signed in and optional analytics cookies to
          understand usage. You can disable non-essential cookies in your browser; the core service
          still works.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">8. Children</h2>
        <p className="mt-2">
          The service is intended for adults. We do not knowingly collect personal data from anyone
          under 16. If you believe a minor has provided us data, contact us and we will delete it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">9. Changes</h2>
        <p className="mt-2">
          We will post material changes here and update the &ldquo;Last updated&rdquo; date. For
          significant changes we will also notify you by email where we have one on file.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Controller: Cosmic Spirit Guide, operated by Sin Fronteras AI. Privacy contact:{" "}
        <a className="underline" href="mailto:support@cosmicspiritguide.com">
          support@cosmicspiritguide.com
        </a>
        .
      </p>
    </main>
  );
}
