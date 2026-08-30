import type { MetadataRoute } from "next";
import { deck } from "@/lib/tarot/deck";
import { slugify, SITE_BASE_URL } from "@/lib/seo";
import { fetchAllPostSlugs } from "@/lib/blog/queries";
import { loadManifest } from "@/lib/seo/redirects";
import { allSignKeys, signLabel } from "@/lib/seo/programmatic";

const PROD = "https://cosmicspiritguide.com";

// Routes that exist on the new build as indexable hubs/pages (not in the legacy manifest).
const staticRoutes = [
  "", "/tarot", "/birth-chart", "/constellations", "/blog",
  "/zodiac", "/compatibility", "/astrology", "/about", "/contact", "/privacy", "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = staticRoutes.map((p) => ({
    url: PROD + (p || "/"),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p === "" ? 1.0 : 0.8,
  }));

  const cardPages: MetadataRoute.Sitemap = deck.map((c) => ({
    url: PROD + "/tarot/" + slugify(c.name),
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Programmatic families generated from deterministic SIGNS data.
  const zodiacPages: MetadataRoute.Sitemap = allSignKeys().map((sign) => ({
    url: PROD + "/zodiac/" + sign,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const slugs = await fetchAllPostSlugs();
    blogPages = (slugs || [])
      .filter((slug): slug is string => {
        if (typeof slug !== "string") return false;
        return slug.length > 0;
      })
      .map((slug) => ({
        url: PROD + "/blog/" + slug,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
  } catch (err) {
    console.error("[sitemap] blog posts failed:", err);
  }

  // Legacy mirror: include only indexable (KEEP_AND_REBUILD / REFRESH_AND_MIGRATE) rows.
  let mirrorPages: MetadataRoute.Sitemap = [];
  try {
    const manifest = loadManifest();
    mirrorPages = manifest
      .filter((r) => {
        if (!r.indexable) return false;
        return !!r.canonicalUrl;
      })
      .map((r) => ({
        url: r.canonicalUrl as string,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.5,
      }));
  } catch (err) {
    console.error("[sitemap] manifest failed:", err);
  }

  return [...base, ...cardPages, ...zodiacPages, ...blogPages, ...mirrorPages];
}
