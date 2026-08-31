import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Services | Cosmic Spirit Guide",
    description:
      "Cosmic Spirit Guide services: free birth-chart computation, tarot readings, and the invite-only Love Blueprint. Other services are not yet offered.",
    path: "/services",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
    ],
  });
  return metadata;
}

export default function ServicesPage() {
  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Services</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Services</h1>
      <p className="mt-3 text-lg">What you can do on Cosmic Spirit Guide today.</p>

      <ul className="mt-6 space-y-4">
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">Birth Chart</h2>
          <p className="mt-2">Compute your free natal chart from real ephemeris data.</p>
          <Link className="mt-2 inline-block underline" href="/birth-chart">Get started</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">Tarot</h2>
          <p className="mt-2">Draw and interpret tarot cards for reflection.</p>
          <Link className="mt-2 inline-block underline" href="/tarot">Read tarot</Link>
        </li>
        <li className="rounded-lg border p-4">
          <h2 className="text-xl font-medium">Love Blueprint</h2>
          <p className="mt-2">Invite-only relationship report during beta.</p>
          <Link className="mt-2 inline-block underline" href="/reports">Request access</Link>
        </li>
      </ul>
    </main>
  );
}
