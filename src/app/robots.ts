import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/seo";
import { loadManifest } from "@/lib/seo/redirects";

export default function robots(): MetadataRoute.Robots {
  // Disallow legacy paths that are retired (410) or noindex utility routes.
  let disallow: string[] = ["/api/", "/admin/"];
  try {
    const manifest = loadManifest();
    for (const r of manifest) {
      if (r.disposition === "RETIRE_410" || r.disposition === "NOINDEX_UTILITY") {
        if (!disallow.includes(r.oldPath)) disallow.push(r.oldPath);
      }
    }
  } catch (err) {
    console.error("[robots] manifest failed:", err);
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
        crawlDelay: 1,
      },
    ],
    sitemap: SITE_BASE_URL + "/sitemap.xml",
  };
}
