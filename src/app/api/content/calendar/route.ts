import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { submissionAuth } from "@/lib/blog/submissionAuth";

export async function GET(request: Request) {
  const auth = submissionAuth(request);
  if (auth !== "ok") return NextResponse.json({ error: auth === "unconfigured" ? "Submission service not configured" : "Unauthorized" }, { status: auth === "unconfigured" ? 503 : 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const status = url.searchParams.get("status") || "planned";
  if (status !== "planned" || (from && (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(Date.parse(`${from}T00:00:00Z`))))) return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  try {
    const rows = (await query("SELECT id,title,target_keyword,target_url_slug,publish_date::text,priority,status,post_id FROM content_calendar WHERE status=$1 AND ($2::date IS NULL OR publish_date >= $2::date) ORDER BY publish_date ASC NULLS LAST,id ASC LIMIT 200", [status, from])).rows;
    return NextResponse.json({ items: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 }); }
}
