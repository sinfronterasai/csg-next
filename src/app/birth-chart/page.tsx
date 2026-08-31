import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, webApplicationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import BirthChartView from "./BirthChartView";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Free Birth Chart | Cosmic Spirit Guide",
    description:
      "Create your free natal birth chart: Sun, Moon, Ascendant, and the ten planets across the twelve houses. Data-backed astrology from Cosmic Spirit Guide.",
    path: "/birth-chart",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Birth Chart", path: "/birth-chart" }]),
      webApplicationJsonLd({ description: "Free birth-chart tool from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function BirthChartPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Birth Chart", path: "/birth-chart" }]),
    webApplicationJsonLd({ description: "Free birth-chart tool from Cosmic Spirit Guide." })
  );
  return (
    <>
      <SeoJsonLd data={jsonLd} />
      <BirthChartView />
    </>
  );
}
