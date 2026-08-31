import type { MetadataRoute } from "next";
import { deck } from "@/lib/tarot/deck";
import { slugify, SITE_BASE_URL } from "@/lib/seo";
import { fetchAllPostSlugs } from "@/lib/blog/queries";
import { allSignKeys } from "@/lib/seo/programmatic";

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
  add(map, PROD + "/about", 0.5, "yearly");
  // NOTE: /contact, /privacy, /terms are intentionally EXCLUDED from the sitemap.
  // They are reachable but noindex until verified legal/business copy is approved
  // (LEGAL_CONTENT_APPROVAL_REQUIRED). They must not be indexed with placeholder content.

  // Curated, indexable programmatic family: zodiac (distinct per sign).
  for (const sign of allSignKeys()) {
    add(map, PROD + "/zodiac/" + sign, 0.6, "monthly");
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
  // They duplicate the curated families above and would reintroduce
  // non-curated programmatic URLs (astrology/[sun]/[moon], compatibility/[pair])
  // that are noindex until content-QA approves them. Sitemap = curated set only.

  return Array.from(map.values());
}
