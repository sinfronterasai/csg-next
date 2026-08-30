import { NextRequest } from "next/server";

// Intentional 410 for the legacy /horoscope family. All 13 shared one title/description
// with no real dated data. We do not fabricate daily horoscopes.
export const dynamic = "force-static";

export function GET(req: NextRequest, ctx: { params: Promise<{ slug?: string[] }> }) {
  void req;
  void ctx;
  return new Response(
    "This horoscope page is no longer published. Try your free birth chart for a personalized reading.",
    { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } }
  );
}
