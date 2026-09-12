import { NextRequest } from "next/server";

// Intentional 410 for the legacy /transits family. These were static generic prose
// with no real computed ephemeris data. We do not fabricate dated transit pages.
// The real transit engine lives in src/lib/transit.ts for a future dated feature.
export const dynamic = "force-static";

export function GET(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  void req;
  void ctx;
  return new Response(
    "This transit page is no longer published. Cosmic Spirit Guide serves live transits via your birth chart.",
    { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } }
  );
}
