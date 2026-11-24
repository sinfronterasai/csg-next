import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { submissionAuth } from "@/lib/blog/submissionAuth";
import { assertSanityWriteConfigured, sanityWriteClient } from "@/lib/sanity/write";

export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const auth = submissionAuth(request);
  if (auth !== "ok") return NextResponse.json({ error: auth === "unconfigured" ? "Submission service not configured" : "Unauthorized" }, { status: auth === "unconfigured" ? 503 : 401 });
  const { submissionId } = await context.params;
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(submissionId)) return NextResponse.json({ error: "Invalid submission ID" }, { status: 400 });
  try {
    assertSanityWriteConfigured();
    const row = (await query("SELECT revision,package,receipt,sanity_id FROM content_submissions WHERE submission_id=$1", [submissionId])).rows[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const document = await sanityWriteClient.getDocument(row.sanity_id);
    return NextResponse.json({ submissionId, revision: row.revision, package: row.package, receipt: row.receipt, currentSanityDocument: document }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to retrieve submission" }, { status: 503 });
  }
}
