import type { MetadataRoute } from "next";
import { deck } from "@/lib/tarot/deck";
import { slugify, SITE_BASE_URL } from "@/lib/seo";
import { fetchAllPostSlugs } from "@/lib/blog/queries";
import { allSignKeys } from "@/lib/seo/programmatic";
import { isProgrammaticIndexed } from "@/lib/seo/programmatic-approval";

const PROD = "https://cosmicspiritguide.com";

// Helper: accumulate unique URLs keyed by canonical (dedupe by absolute URL).
function add(map: Map<string, MetadataRoute.Sitemap[number]>, url: string, priority: number, change: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  const u = url.replace(/\/$/, "") || PROD + "/";
  if (map.has(u)) return;
  map.set(u, { url: u, changeFrequency: change, priority });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const map = new Map<string, MetadataRoute.Sitemap[number]>();

  // Core indexable pages that actually exist on the new build.
  add(map, PROD + "/", 1.0, "weekly");
  add(map, PROD + "/astrology", 0.8, "weekly");
  add(map, PROD + "/compatibility", 0.8, "weekly");
  add(map, PROD + "/zodiac", 0.8, "weekly");
  add(map, PROD + "/tarot", 0.8, "weekly");
  add(map, PROD + "/birth-chart", 0.8, "weekly");
  add(map, PROD + "/blog", 0.8, "weekly");
  add(map, PROD + "/reports", 0.7, "weekly");
  add(map, PROD + "/constellations", 0.6, "monthly");
  // Honest, launch-ready entity/commercial pages (indexable).
  add(map, PROD + "/about", 0.5, "yearly");
  add(map, PROD + "/contact", 0.5, "yearly");
  add(map, PROD + "/privacy", 0.4, "yearly");
  add(map, PROD + "/terms", 0.4, "yearly");
  add(map, PROD + "/pricing", 0.6, "monthly");
  add(map, PROD + "/services", 0.6, "monthly");

  // Programmatic routes enter the sitemap only after page-level approval.
  for (const sign of allSignKeys()) {
    if (isProgrammaticIndexed("zodiac", sign, sign)) {
      add(map, PROD + "/zodiac/" + sign, 0.6, "monthly");
    }
  }

  // Tarot cards (generated from deck data, distinct per card).
  for (const c of deck) {
    add(map, PROD + "/tarot/" + slugify(c.name), 0.7, "monthly");
  }

  // Blog: only live Sanity production slugs (real, curated content).
  try {
    const slugs = await fetchAllPostSlugs();
    for (const slug of slugs || []) {
      if (typeof slug === "string" && slug.length > 0) {
        add(map, PROD + "/blog/" + slug, 0.8, "weekly");
      }
    }
  } catch (err) {
    console.error("[sitemap] blog posts failed:", err);
  }

  // NOTE: legacy-mirror KEEP_AND_REBUILD rows are intentionally NOT merged here.
  // The Sun/Moon and compatibility-pair grids are live but NOINDEX until
  // content-QA promotes them; sitemap = curated indexable set only.

  return Array.from(map.values());
}
