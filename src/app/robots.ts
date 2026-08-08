import type { MetadataRoute } from "next";
import { SITE_BASE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
        crawlDelay: 1,
      },
    ],
    sitemap: `${SITE_BASE_URL}/sitemap.xml`,
  };
}
