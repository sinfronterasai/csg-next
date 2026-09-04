import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, webApplicationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import Constellations from "./ConstellationsView";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata, jsonLd } = buildMetadata({
    title: "Interactive Star Map & Named Stars | Cosmic Spirit Guide",
    description:
      "Orbit an interactive celestial map of the night sky and meet the named stars — Sirius, Polaris, Vega, Betelgeuse and more. A free cosmic navigator from Cosmic Spirit Guide.",
    path: "/constellations",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Constellations", path: "/constellations" }]),
      webApplicationJsonLd({ description: "Interactive celestial star map from Cosmic Spirit Guide." })
    ),
  });
  return metadata;
}

export default function ConstellationsPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Constellations", path: "/constellations" }]),
    webApplicationJsonLd({ description: "Interactive celestial star map from Cosmic Spirit Guide." })
  );
  return (
    <>
      <SeoJsonLd data={jsonLd} />
      <Constellations />
    </>
  );
}
