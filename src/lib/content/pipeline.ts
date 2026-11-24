/**
 * Content pipeline — pure helpers.
 *
 * Ported from the legacy `sinfronterasai/csg` cron route
 * (`app/api/cron/content-pipeline/route.js`) after that repo stopped serving
 * production. Nothing here performs I/O, so every rule below is unit-testable.
 *
 * PUBLICATION CONTRACT (must not be relaxed):
 *   Generated documents are written as `status: "draft"` with
 *   `review.status: "pending"`. The public blog queries only render documents
 *   that are BOTH `status == "published"` AND `review.status == "approved"`
 *   (see `src/lib/blog/queries.ts`), so a draft can never reach a customer
 *   until a human approves it in Sanity.
 */

import { markdownToPortableText, countWords } from "./portable-text";

export interface PipelineArtifact {
  _id: string;
  slug: string;
  title: string;
}

/** Stable Sanity `_id` for a brief, derived from its title. */
export function briefId(title: string): string {
  return `blogPost.${slugify(title)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function titleOf(brief: { title_options?: string[]; title?: string }): string {
  return (brief.title_options?.[0] || brief.title || "").trim();
}

/**
 * Pick the first brief that has no Sanity document yet.
 *
 * Idempotent by construction: the legacy implementation tracked progress in
 * `/tmp/content-pipeline-state.json`, which is wiped on every Render restart
 * and is per-instance — that is how the pipeline could silently re-run or lose
 * its place. Deriving "already done" from the documents that actually exist is
 * restart-safe and cannot double-publish.
 */
export function pickNextBrief<T extends { title_options?: string[]; title?: string }>(
  briefs: T[],
  existingIds: Iterable<string>,
): T | null {
  const taken = new Set(existingIds);
  for (const brief of briefs) {
    if (!taken.has(briefId(titleOf(brief)))) return brief;
  }
  return null;
}

export function buildSystemPrompt(): string {
  return [
    "You are the senior astrology editor for Cosmic Spirit Guide, an astrology and",
    "spirituality publisher. You write accurate, warm, practical long-form articles.",
    "",
    "Rules:",
    "- Write ONLY the article body in Markdown. Do not include the H1 title.",
    "- Start sections with '## ' for main headings and '### ' for subheadings.",
    "- Use short paragraphs and bullet lists where they genuinely help.",
    "- Never invent statistics, studies, quotes, or sources.",
    "- Never mention that you are an AI model.",
    "- Do not add a call-to-action section; the publisher appends it.",
  ].join("\n");
}

export function buildUserPrompt(brief: {
  target_keyword?: string;
  title_options?: string[];
  title?: string;
  meta_description?: string;
  h2_headings?: string[];
  target_word_count?: number;
  search_intent?: string;
}): string {
  const title = titleOf(brief);
  const headings = brief.h2_headings ?? [];
  const words = brief.target_word_count ?? 1200;

  return [
    `Article title: ${title}`,
    `Target keyword: ${brief.target_keyword || title}`,
    brief.search_intent ? `Search intent: ${brief.search_intent}` : "",
    brief.meta_description ? `Reader promise: ${brief.meta_description}` : "",
    `Target length: about ${words} words.`,
    "",
    headings.length
      ? `Use these H2 sections, in this order, with these exact headings:\n${headings
          .map((h) => `- ${h}`)
          .join("\n")}`
      : "",
    "",
    "Write the full article now.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildExcerpt(markdown: string, fallback: string): string {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const firstParagraph = plain.split(/(?<=\.)\s/)[0] ?? "";
  const source = firstParagraph.length > 60 ? firstParagraph : plain;
  const excerpt = (source || fallback).trim();
  return excerpt.length > 300 ? `${excerpt.slice(0, 297).trimEnd()}...` : excerpt;
}

export interface SanityDraftDoc {
  _id: string;
  _type: "blogPost";
  title: string;
  slug: { _type: "slug"; current: string };
  excerpt: string;
  content: unknown[];
  status: "draft";
  review: { status: "pending"; hardFailFlags: string[] };
  seoTitle: string;
  metaDescription: string;
  author: string;
  readingTime: number;
  wordCount: number;
  targetKeyword?: string;
  metaTitle?: string;
}

/**
 * Build the Sanity document. `status` and `review.status` are hard-coded so no
 * caller can accidentally publish an unreviewed post.
 */
export function buildSanityDoc(args: {
  brief: {
    target_keyword?: string;
    title_options?: string[];
    title?: string;
    meta_description?: string;
  };
  markdown: string;
}): SanityDraftDoc {
  const title = titleOf(args.brief);
  const slug = slugify(title);
  const wordCount = countWords(args.markdown);
  const excerpt = buildExcerpt(args.markdown, args.brief.meta_description ?? title);

  return {
    _id: briefId(title),
    _type: "blogPost",
    title,
    slug: { _type: "slug", current: slug },
    excerpt,
    content: markdownToPortableText(args.markdown),
    // Hard-coded: never publish without human review.
    status: "draft",
    review: { status: "pending", hardFailFlags: [] },
    seoTitle: title,
    metaDescription: args.brief.meta_description ?? excerpt,
    author: "Cosmic Spirit Guide",
    readingTime: Math.max(1, Math.ceil(wordCount / 220)),
    wordCount,
    targetKeyword: args.brief.target_keyword || undefined,
    // Legacy field name kept for editors who still filter on it.
    metaTitle: title,
  };
}

export function existingIdsQuery(): string {
  return `*[_type == "blogPost" && defined(slug.current)].{_id, "slug": slug.current}`;
}
