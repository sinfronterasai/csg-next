// Builds a schema.org BreadcrumbList JSON-LD object for a blog location.
// Keeps the "Home -> Blog -> Article" trail explicit for search + AI engines.
import { SITE_BASE_URL } from "@/lib/seo";

export interface Crumb {
  name: string;
  path: string; // absolute path, e.g. "/blog" or "/blog/my-post"
}

export function buildBreadcrumbList(crumbs: Crumb[]): string {
  const items = crumbs.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: `${SITE_BASE_URL}${c.path}`,
  }));
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  });
}
