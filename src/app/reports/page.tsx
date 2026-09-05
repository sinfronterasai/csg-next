import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, webApplicationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import ReportsView from "./ReportsView";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Reports & Products | Cosmic Spirit Guide",
    description:
      "Explore Cosmic Spirit Guide reports: your free Birth Chart, the Love Blueprint — your Venus, Mars and Moon signature, and other premium insights as they launch. Available products only.",
    path: "/reports",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Reports", path: "/reports" }]),
      webApplicationJsonLd({ description: "Reports and products from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function ReportsPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Reports", path: "/reports" }]),
    webApplicationJsonLd({ description: "Reports and products from Cosmic Spirit Guide." })
  );
  return (
    <>
      <SeoJsonLd data={jsonLd} />
      <ReportsView />
    </>
  );
}
