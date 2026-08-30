// SEO helpers for programmatic page generation (mirrors old-csg pseo pattern,
// scoped to csg-next's actual surface: tarot cards + the real top-level routes).
export const SITE_BASE_URL = "https://cosmicspiritguide.com";

/** "The Fool" -> "the-fool", "Ace of Wands" -> "ace-of-wands" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
