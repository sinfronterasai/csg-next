import { NextRequest, NextResponse } from "next/server";
import { getXRobotsTag } from "@/lib/seo/host";
import { REDIRECT_MAP } from "@/lib/seo/redirect-map";

export function middleware(req: NextRequest) {
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || null;
  const url = req.nextUrl.clone();
  const key = url.pathname.replace(/\/$/, "") || "/";

  // Manifest-driven legacy cutover (edge-safe map, no fs/node).
  const decision = REDIRECT_MAP[key];
  if (decision) {
    if (decision.status === 410) {
      return new NextResponse("This page is no longer published.", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
      });
    }
    if (decision.status === 301) {
      if (decision.target) {
        return NextResponse.redirect(decision.target, 301);
      }
    }
  }

  const res = NextResponse.next();
  const tag = getXRobotsTag(host);
  if (tag) res.headers.set("X-Robots-Tag", tag);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|xml)$).*)",
  ],
};
