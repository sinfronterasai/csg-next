import { NextResponse } from "next/server";
import { generateText } from "@/lib/groq";
import { CONTENT_BRIEFS } from "@/lib/content/briefs";
import {
  buildSanityDoc,
  buildSystemPrompt,
  buildUserPrompt,
  existingIdsQuery,
  pickNextBrief,
  titleOf,
} from "@/lib/content/pipeline";
import { getSanityWriteClient, SANITY_WRITE_DATASET } from "@/lib/sanity/write-client";

export const dynamic = "force-dynamic";
// Generation is a single Groq call plus one Sanity write; 60s is ample and keeps
// a stuck run from holding the cron worker open.
export const maxDuration = 60;

const ROUTE = "/api/cron/content-pipeline";

function safeErrorDetails(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "Unknown error";
  const message = rawMessage
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: message,
  };
}

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  console.error(`[content-pipeline] failed`, { route: ROUTE, error, status, ...extra });
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/**
 * POST /api/cron/content-pipeline
 *
 * Invoked by the Render cron job `content-pipeline` (daily 10:00). Creates
 * exactly ONE draft blog post per run, for the first content brief that has no
 * Sanity document yet.
 *
 * Never publishes: documents are written as `status: "draft"` with
 * `review.status: "pending"`, so the public blog cannot render them until a
 * human approves them in Sanity Studio.
 *
 * Responses are deliberately non-2xx on every failure so the caller
 * (`curl --fail-with-body`) exits non-zero and Render reports the run as
 * failed instead of silently "successful".
 */
export async function POST(request: Request) {
  const startedAt = Date.now();

  const secret = (process.env.CRON_SECRET || "").trim();
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return fail("CRON_SECRET is not configured on this service", 500, {
      reason: "server_secret_missing",
    });
  }

  if (authorization !== `Bearer ${secret}`) {
    return fail("Unauthorized", 401, { reason: "authorization_invalid" });
  }

  const sanity = getSanityWriteClient();
  if (!sanity) {
    return fail(
      "No Sanity write token configured (set SANITY_API_WRITE_TOKEN or SANITY_API_TOKEN with write access)",
      500,
      { reason: "sanity_write_token_missing" },
    );
  }

  let existing: Array<{ _id?: string; slug?: string }>;
  try {
    existing = await sanity.fetch(existingIdsQuery());
  } catch (error) {
    return fail("Could not read existing posts from Sanity", 502, {
      phase: "sanity_read",
      ...safeErrorDetails(error),
    });
  }

  const existingIds = new Set(
    (existing || []).flatMap((doc) => [doc?._id, doc?.slug ? `blogPost.${doc.slug}` : null]).filter(Boolean) as string[],
  );

  const brief = pickNextBrief(CONTENT_BRIEFS, existingIds);
  if (!brief) {
    // Nothing to do is a success, not a failure: the brief deck is exhausted.
    console.info("[content-pipeline] backlog complete", {
      route: ROUTE,
      briefs: CONTENT_BRIEFS.length,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: true,
      status: "backlog_complete",
      briefsTotal: CONTENT_BRIEFS.length,
      message: "Every content brief already has a Sanity document.",
    });
  }

  const title = titleOf(brief);

  let markdown: string;
  try {
    markdown = await generateText(buildUserPrompt(brief), {
      systemPrompt: buildSystemPrompt(),
      temperature: 0.7,
      max_tokens: 4000,
    });
  } catch (error) {
    return fail("Content generation failed", 502, {
      phase: "generation",
      brief: title,
      ...safeErrorDetails(error),
    });
  }

  if (!markdown || markdown.trim().length < 400) {
    return fail("Content generation returned an unusable draft", 502, {
      phase: "generation",
      brief: title,
      characters: markdown?.trim().length ?? 0,
    });
  }

  const doc = buildSanityDoc({ brief, markdown });

  try {
    await sanity.createOrReplace(doc);
  } catch (error) {
    return fail("Could not write the draft to Sanity", 502, {
      phase: "sanity_write",
      brief: title,
      ...safeErrorDetails(error),
    });
  }

  console.info("[content-pipeline] draft created", {
    route: ROUTE,
    brief: title,
    docId: doc._id,
    slug: doc.slug.current,
    wordCount: doc.wordCount,
    status: doc.status,
    review: doc.review.status,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    status: "draft_created",
    brief: title,
    docId: doc._id,
    slug: doc.slug.current,
    wordCount: doc.wordCount,
    dataset: SANITY_WRITE_DATASET,
    // Surfaced so the cron log states unambiguously that nothing went public.
    publication: "draft — awaiting editorial review",
    blogUrl: `https://cosmicspiritguide.com/blog/${doc.slug.current}`,
    durationMs: Date.now() - startedAt,
  });
}

/** Status probe used by operators: which brief is next, without writing. */
export async function GET() {
  const secretConfigured = Boolean((process.env.CRON_SECRET || "").trim());
  const tokenConfigured = Boolean(getSanityWriteClient());

  return NextResponse.json({
    route: ROUTE,
    version: 1,
    briefsTotal: CONTENT_BRIEFS.length,
    nextBrief: titleOf(CONTENT_BRIEFS[0] ?? {}),
    authConfigured: secretConfigured,
    sanityWriteConfigured: tokenConfigured,
  });
}
