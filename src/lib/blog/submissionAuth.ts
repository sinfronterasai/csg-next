import { timingSafeEqual } from "node:crypto";

export function submissionAuth(request: Request): "ok" | "unconfigured" | "unauthorized" {
  const secret = process.env.CSG_CONTENT_SUBMISSION_TOKEN;
  if (!secret) return "unconfigured";
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? "ok" : "unauthorized";
}
