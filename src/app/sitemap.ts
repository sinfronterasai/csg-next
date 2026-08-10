import type { MetadataRoute } from "next";
import { deck } from "@/lib/tarot/deck";
import { slugify, SITE_BASE_URL } from "@/lib/seo";

const staticRoutes = ["", "/tarot", "/birth-chart", "/constellations", "/my-chart", "/reports", "/blog"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = staticRoutes.map((p) => ({
    url: `${SITE_BASE_URL}${p || "/"}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "" ? 1.0 : 0.8,
  }));

  const cardPages: MetadataRoute.Sitemap = deck.map((c) => ({
    url: `${SITE_BASE_URL}/tarot/${slugify(c.name)}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const { fetchLatestPost } = await import("@/lib/blog/queries");
    const latest = await fetchLatestPost();
    if (latest?.slug?.current) {
      blogPages = [{
        url: `${SITE_BASE_URL}/blog/${latest.slug.current}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }];
    }
  } catch (err) {
    console.error("[sitemap] latest blog post failed:", err);
  }

  return [...staticPages, ...cardPages, ...blogPages];
}
