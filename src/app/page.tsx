import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, webApplicationJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import HomeView from "@/components/HomeView";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Cosmic Spirit Guide | Free Birth Chart, Tarot & Zodiac Insights",
    description:
      "Generate your free birth chart, read your tarot, and explore the twelve zodiac signs with Cosmic Spirit Guide. Data-backed astrology and tarot tools.",
    path: "/",
    type: "website",
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      webApplicationJsonLd({
        name: "Cosmic Spirit Guide",
        description: "Free birth-chart, tarot, and zodiac tools.",
      })
    ),
  });
  return metadata;
}

export default function Home() {
  return <HomeView />;
}
