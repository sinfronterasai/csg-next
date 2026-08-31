import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, webApplicationJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import ReportsView from "./ReportsView";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Reports & Products | Cosmic Spirit Guide",
    description:
      "Explore Cosmic Spirit Guide reports: your free Birth Chart, Relationship Matrix, and premium Tarot and transit insights. Available products only.",
    path: "/reports",
    type: "website",
    noindex: true,
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      webApplicationJsonLd({ description: "Reports and products from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function ReportsPage() {
  return <ReportsView />;
}
