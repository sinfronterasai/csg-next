import { NextRequest, NextResponse } from "next/server";
import { getXRobotsTag } from "@/lib/seo/host";
import { REDIRECT_MAP } from "@/lib/seo/redirect-map";

export function middleware(req: NextRequest) {
  const host =
    req.headers.get("host") || req.headers.get("x-forwarded-host") || null;
  const tag = getXRobotsTag(host);
  const withRobotsTag = (response: NextResponse) => {
    if (tag) response.headers.set("X-Robots-Tag", tag);
    return response;
  };
  const url = req.nextUrl.clone();
  const key = url.pathname.replace(/\/$/, "") || "/";

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
