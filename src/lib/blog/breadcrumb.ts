// Builds a schema.org BreadcrumbList JSON-LD object for a blog location.
// Keeps the "Home -> Blog -> Article" trail explicit for search + AI engines.
import { SITE_BASE_URL } from "@/lib/seo";

export interface Crumb {
  name: string;
  path: string; // absolute path, e.g. "/blog" or "/blog/my-post"
}

// JSON-LD is injected via dangerouslySetInnerHTML. Without escaping, a title
// containing "</script>" (or < > &, or U+2028/U+2029) would break out of the
// script element or corrupt the structured data. Escape the characters that
// are unsafe inside an HTML <script> context before emitting.
export function escapeJsonLd(json: string): string {
  return json
    .replace(/\u2028/g, "\u2028")
    .replace(/\u2029/g, "\u2029")
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");
}

export function buildBreadcrumbList(crumbs: Crumb[]): string {
  const items = crumbs.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: `${SITE_BASE_URL}${c.path}`,
  }));
  return escapeJsonLd(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    }),
  );
}
