import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generateText } from "@/lib/groq";
import { markdownToPortableText, clipWords } from "@/lib/blog/portableText";
import { sanityWriteClient, assertSanityWriteConfigured } from "@/lib/sanity/write";

// /api/cron/content-pipeline
//
// The Render cron `content-pipeline` (crn-d7ispgd8nd3s738mcn00) POSTs here
// daily at 10:00 UTC. This route is the server-side equivalent of the n8n
// workflow "CSG — Content Pipeline · Brief to Draft": pick the next planned
// topic, generate an article with Groq, lint it, write a draft to Postgres,
// then promote that draft into Sanity as a `blogPost` document.
//
// The Sanity document is created with status "draft" and NO review approval,
// so it stays invisible to the public site (see src/lib/blog/queries.ts, which
// requires status == "published" AND review.status == "approved").
//
// Auth: `Authorization: Bearer ${CRON_SECRET}`. A missing or wrong secret is a
// 401, never a silent success.

const ROUTE = "/api/cron/content-pipeline";

const CATEGORY_REFS: Record<string, string> = {
  "daily-guidance": "IU1t4ksBz8KfIWyvfd6hhq",
  astrology: "IU1t4ksBz8KfIWyvfd6j9e",
  tarot: "IU1t4ksBz8KfIWyvfd6kjs",
  technology: "IU1t4ksBz8KfIWyvfd6l0i",
  "personal-empowerment": "IU1t4ksBz8KfIWyvfd6nx8",
  "parenting-spirituality": "IU1t4ksBz8KfIWyvfd7XGO",
  "modern-spiritualization": "Sr25UmBiPT0sStIPqL2DfH",
  spirituality: "Sr25UmBiPT0sStIPqL2EIl",
  "digital-divination": "Sr25UmBiPT0sStIPqL2Fwx",
  "tarot-reading": "i3BfC4ws1E77bEHjTTmiqF",
  "tarot-readings": "i3BfC4ws1E77bEHjTTmj0h",
  "ai-tarot": "i3BfC4ws1E77bEHjTTmjmJ",
  "astrology-tarot": "i3BfC4ws1E77bEHjTTmk9X",
  "ai-tools": "i3BfC4ws1E77bEHjTTmkkh",
  divination: "i3BfC4ws1E77bEHjTTmkpL",
  ai: "i3BfC4ws1E77bEHjTTmkv9",
};

const BANNED_PHRASES = [
  "with time and effort",
  "navigate life's challenges with greater ease",
  "navigate the complexities of life",
  "the universe is calling upon you",
  "the universe is always guiding you",
  "a journey of self-discovery",
  "embark on this journey",
  "embark on a journey",
  "embrace the challenges and opportunities",
  "you possess the inner wisdom",
  "a tapestry of energies",
  "trust in the process",
  "soulmate",
  "twin flame",
  "destined to be together",
  "meant to be together",
  "you will marry",
  "you will meet the one",
  "they will come back",
  "this is your fate",
  "doomed",
  "cursed",
  "ruined by",
];

const PROMISE_PATTERNS = [
  /\b(we|i|this report|this reading|your chart|the cards|the stars|the universe)\s+guarantee/,
  /\bguarantees?\s+you\b/,
  /\bguaranteed\s+(love|success|money|wealth|results?|outcome|reunion|return|happiness)\b/,
  /\byou\s+will\s+(marry|meet the one|get (him|her) back|be rich|become wealthy)\b/,
  /\b(100%|one hundred percent)\s+(accurate|guaranteed|sure)\b/,
];

interface Article {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  category: string;
  metaTitle: string;
  metaDescription: string;
  readingTime: number;
}

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Normalise typography the writer reliably gets wrong (dashes, smart quotes). */
function normalizeTypography(value: string): string {
  return String(value)
    .replace(/(\w)\s*[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]\s*(\w)/g, "$1-$2")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, " - ")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1");
}

function parseArticle(raw: string): any {
  const text = String(raw || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Writer returned non-JSON output");
  }
}

function lint(article: Article, wordCount: number): string[] {
  const issues: string[] = [];
  const body = article.content;
  const lower = body.toLowerCase();

  if (!article.title) issues.push("structure: missing title");
  if (!article.slug) issues.push("structure: missing slug");
  if (!/^[a-z0-9-]+$/.test(article.slug)) issues.push("structure: slug is not url-safe");
  if (!article.metaDescription) issues.push("seo: missing meta_description");
  if (wordCount < 700) issues.push(`length: body is ${wordCount} words, minimum is 700`);
  if (wordCount > 2200) issues.push(`length: body is ${wordCount} words, maximum is 2200`);
  if (!/^##\s/m.test(body)) issues.push("structure: no H2 sections");

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) issues.push(`bannedPhrase: ${phrase}`);
  }
  for (const pattern of PROMISE_PATTERNS) {
    const match = lower.match(pattern);
    if (match) issues.push(`promise: ${match[0]}`);
  }
  if (/[\u2014\u2013]/.test(body)) issues.push("style: em dash or en dash present");
  if (!/\/free-birth-chart|\/reports/.test(body)) issues.push("conversion: no internal link to a CSG offer");

  return issues;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted-token]")
    .slice(0, 300);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  // Reuse the cron secret already provisioned on this service rather than
  // requiring a second one. CRON_SECRET is honoured first if it is ever set.
  const secret = process.env.CRON_SECRET || process.env.RESEND_OUTBOX_CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    console.error(`[${ROUTE}] no cron secret is set on the service`);
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (authorization !== `Bearer ${secret}`) {
    console.warn(`[${ROUTE}] unauthorized request`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSanityWriteConfigured();
  } catch (error) {
    console.error(`[${ROUTE}] sanity write not configured`, safeError(error));
    return NextResponse.json({ error: "Sanity write token not configured" }, { status: 500 });
  }

  // 1. Pick the next planned topic.
  const topicResult = await query(
    `SELECT id, title, target_keyword, content_type, priority, publish_date::text AS publish_date
       FROM content_calendar
      WHERE status = 'planned'
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               publish_date ASC NULLS LAST,
               id ASC
      LIMIT 1`,
  );

  const topic = topicResult.rows[0];
  if (!topic) {
    return NextResponse.json({ ok: true, outcome: "no_planned_topic", message: "content_calendar has no planned topics" });
  }
  if (!topic.title || !String(topic.title).trim()) {
    return NextResponse.json({ error: `Planned topic ${topic.id} has no title` }, { status: 500 });
  }
  if (!topic.target_keyword || !String(topic.target_keyword).trim()) {
    return NextResponse.json({ error: `Planned topic ${topic.id} has no target_keyword` }, { status: 500 });
  }

  const calendarId = Number(topic.id);
  const topicTitle = String(topic.title).trim();
  const targetKeyword = String(topic.target_keyword).trim();

  // 2. Existing titles, so the writer does not duplicate an article.
  const existingResult = await query(`SELECT title, slug FROM blog_posts ORDER BY id DESC LIMIT 200`);
  const existingTitles = existingResult.rows.map((row: any) => row.title).filter(Boolean);
  const existingSlugs = new Set(existingResult.rows.map((row: any) => row.slug).filter(Boolean));

  // 3. Generate the article.
  const prompt = [
    "You are the senior writer for Cosmic Spirit Guide, an astrology and tarot guidance site.",
    "Write ONE complete, publish-ready blog article as strict JSON. No markdown fences, no commentary.",
    "",
    `TOPIC: ${topicTitle}`,
    `PRIMARY KEYWORD: ${targetKeyword}`,
    `CATEGORY: ${topic.content_type || "blog_post"}`,
    "",
    "VOICE: mystical but grounded. Warm second person. Quiet authority with a little poetry. The stars suggest, the reader decides.",
    "Astrology and tarot are presented as interpretive, reflective guidance, never as scientifically established prediction.",
    "",
    "HARD RULES:",
    "- Never promise or guarantee an outcome (love, money, health, reunion, destiny).",
    "- No fatalism, no fear-mongering, no medical, legal or financial advice.",
    "- No em dashes or en dashes. Use a single hyphen with spaces if a dash is needed.",
    "- Do not invent statistics, studies, or citations.",
    `- Do not duplicate these existing articles: ${existingTitles.length ? existingTitles.join("; ") : "none"}`,
    "",
    "STRUCTURE: 900 to 1400 words of markdown body. Open with a concrete observation, not a greeting.",
    "Use 3 to 5 H2 sections. Include one short practical exercise or reflection prompt.",
    "End with a natural, non-pushy invitation to the free birth chart tool at /free-birth-chart and the paid reports at /reports.",
    "",
    "Return ONLY this JSON shape:",
    '{"title":"...","excerpt":"...","content":"markdown body","metaTitle":"...","metaDescription":"...","tags":["..."],"category":"astrology","keyPoints":["..."]}',
  ].join("\n");

  const raw = await generateText(prompt, { temperature: 0.7, max_tokens: 4000 });
  const parsed = parseArticle(raw);

  if (!parsed.title || !String(parsed.title).trim()) throw new Error("Writer returned no title");
  if (!parsed.content || String(parsed.content).trim().length < 400) throw new Error("Writer returned no usable body");

  // 4. Normalise and shape.
  let slug = slugify(parsed.title);
  if (!slug) throw new Error("Could not derive a slug from the title");
  if (existingSlugs.has(slug)) {
    let n = 2;
    while (existingSlugs.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }

  const body = normalizeTypography(String(parsed.content).trim());
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  const article: Article = {
    title: normalizeTypography(String(parsed.title).trim()).slice(0, 200),
    slug,
    excerpt: normalizeTypography(String(parsed.excerpt || body.slice(0, 200)).trim()).slice(0, 500),
    content: body,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [],
    category: String(parsed.category || "astrology").trim().slice(0, 60),
    // B-06: clip to the Sanity ceilings here, at the source, so the write can
    // never be rejected for over-length SEO fields.
    metaTitle: clipWords(normalizeTypography(String(parsed.metaTitle || parsed.title)), 60),
    metaDescription: clipWords(normalizeTypography(String(parsed.metaDescription || parsed.excerpt || "")), 160),
    readingTime: Math.max(1, Math.round(wordCount / 220)),
  };

  // 5. Lint. A failing article writes nothing and leaves the calendar untouched.
  const issues = lint(article, wordCount);
  if (issues.length) {
    console.warn(`[${ROUTE}] article rejected by lint`, { calendarId, issues });
    return NextResponse.json(
      { ok: false, outcome: "rejected_by_lint", calendarId, topicTitle, wordCount, issues },
      { status: 200 },
    );
  }

  // 6. Write the draft to Postgres.
  const insertResult = await query(
    `INSERT INTO blog_posts
       (title, slug, excerpt, content, status, tags, category, meta_title, meta_description, reading_time, locale)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, 'en')
     RETURNING id, slug, status, title`,
    [
      article.title,
      article.slug,
      article.excerpt,
      article.content,
      article.tags,
      article.category,
      article.metaTitle,
      article.metaDescription,
      article.readingTime,
    ],
  );
  const post = insertResult.rows[0];

  await query(
    `UPDATE content_calendar SET status = 'drafting', post_id = $1, updated_at = now() WHERE id = $2`,
    [post.id, calendarId],
  );

  await query(
    `INSERT INTO publishing_workflow (calendar_id, step_name, status, assigned_to, due_date, completed_at, notes)
     VALUES ($1, 'draft_generated', 'completed', 'render-content-pipeline', CURRENT_DATE, now(), $2)`,
    [calendarId, `Draft post id ${post.id} generated by Render content-pipeline cron, awaiting editorial review`],
  );

  // 7. Promote into Sanity as a draft (approval gate: no publish, no review approval).
  const tagSlugs = article.tags
    .map((tag) => slugify(tag))
    .filter(Boolean)
    .slice(0, 8);

  let tagRefs: { _key: string; _type: "reference"; _ref: string }[] = [];
  let unresolvedTags: string[] = tagSlugs;

  if (tagSlugs.length) {
    const tagDocs: any[] = await sanityWriteClient.fetch(
      `*[_type == "tag" && slug.current in $slugs]{"s": slug.current, "i": _id}`,
      { slugs: tagSlugs },
    );
    const map = new Map<string, string>(tagDocs.map((row) => [row.s, row.i]));
    tagRefs = tagSlugs
      .filter((s) => map.has(s))
      .map((s, index) => ({ _key: `tag${index}`, _type: "reference" as const, _ref: map.get(s) as string }));
    unresolvedTags = tagSlugs.filter((s) => !map.has(s));
  }

  const categoryRef = CATEGORY_REFS[article.category.toLowerCase()] || CATEGORY_REFS.astrology;
  const sanityId = `blogPost-${article.slug.slice(0, 80)}`;

  const sanityDoc = {
    _id: sanityId,
    _type: "blogPost",
    title: clipWords(article.title, 120),
    slug: { _type: "slug", current: article.slug },
    excerpt: clipWords(article.excerpt, 300),
    content: markdownToPortableText(article.content),
    status: "draft",
    category: { _type: "reference", _ref: categoryRef },
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    readingTime: article.readingTime,
    ...(tagRefs.length ? { tags: tagRefs } : {}),
  };

  const mutation = await sanityWriteClient.mutate([
    { createOrReplace: sanityDoc as any },
  ]);

  // 8. Read the document back. Never report success on the mutation alone.
  const readBack: any = await sanityWriteClient.fetch(
    `*[_id == $id][0]{_id, _type, title, status, "slug": slug.current, "blocks": count(content), "tagCount": count(tags)}`,
    { id: sanityId },
  );

  if (!readBack || readBack._id !== sanityId) {
    throw new Error(`Sanity read-back returned no document for ${sanityId}`);
  }
  if (readBack.status !== "draft") {
    throw new Error(`Sanity document is not in draft status: ${readBack.status}`);
  }

  await query(
    `UPDATE blog_posts SET sanity_id = $1, sanity_synced_at = now(), updated_at = now() WHERE id = $2`,
    [sanityId, post.id],
  );

  await query(
    `INSERT INTO publishing_workflow (calendar_id, step_name, status, assigned_to, due_date, completed_at, notes)
     VALUES ($1, 'sanity_draft_created', 'completed', 'render-content-pipeline', CURRENT_DATE, now(), $2)`,
    [
      calendarId,
      `Sanity draft ${sanityId} created for blog_posts id ${post.id}, status draft, awaiting editorial approval before publish`,
    ],
  );

  console.info(`[${ROUTE}] completed`, {
    durationMs: Date.now() - startedAt,
    calendarId,
    blogPostId: post.id,
    sanityId,
    wordCount,
  });

  return NextResponse.json({
    ok: true,
    outcome: "sanity_draft_created",
    calendarId,
    topicTitle,
    targetKeyword,
    blogPostId: post.id,
    slug: post.slug,
    wordCount,
    readingTime: article.readingTime,
    sanityId,
    sanityStatus: readBack.status,
    sanityBlockCount: readBack.blocks,
    sanityTagCount: readBack.tagCount,
    unresolvedTags,
    metaTitleLength: article.metaTitle.length,
    metaDescriptionLength: article.metaDescription.length,
    transactionId: mutation.transactionId,
    publishGate: "awaiting_editorial_approval",
    durationMs: Date.now() - startedAt,
  });
}
