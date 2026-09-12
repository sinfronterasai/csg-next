import { NextRequest, NextResponse } from "next/server";
import { getXRobotsTag, isProductionHost } from "@/lib/seo/host";
import { REDIRECT_MAP } from "@/lib/seo/redirect-map";

export function middleware(req: NextRequest) {
  const host =
    req.headers.get("host") || req.headers.get("x-forwarded-host") || null;
  const url = req.nextUrl.clone();
  const key = url.pathname.replace(/\/$/, "") || "/";

  // Path-level noindex: /profile is a NOINDEX_UTILITY account route reachable on
  // production but must never be indexed (robots.txt Disallow alone is not an
  // effective indexing directive — crawlers can still index URLs discovered via
  // links, sitemaps, or external references).
  const isProfilePath = key === "/profile";
  const isProdHost = isProductionHost(host);
  const previewNoindex = getXRobotsTag(host);
  const tag =
    previewNoindex ??
    (isProdHost && isProfilePath ? "noindex, nofollow" : null);

  const withRobotsTag = (response: NextResponse) => {
    if (tag) response.headers.set("X-Robots-Tag", tag);
    return response;
  };

  // Manifest-driven legacy cutover (edge-safe map, no fs/node).
  const decision = REDIRECT_MAP[key];
  if (decision) {
    if (decision.status === 410) {
      return withRobotsTag(new NextResponse("This page is no longer published.", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
      }));
    }
    if (decision.status === 301 && decision.target) {
      return withRobotsTag(NextResponse.redirect(decision.target, 301));
    }
  }

  return withRobotsTag(NextResponse.next());
}

export const config = {
  matcher: [
    "/robots.txt",
    "/sitemap.xml",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json)$).*)",
  ],
};
