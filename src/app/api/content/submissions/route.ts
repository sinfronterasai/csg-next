import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// The submission contract is intentionally closed until the editorial team
// agrees on the payload. Never accept or persist a body at this stage.
export async function POST(request: Request) {
  const secret = process.env.CSG_CONTENT_SUBMISSION_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "Submission service not configured" }, { status: 503 });
  }
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Submission format pending", outcome: "not_accepting_submissions" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
