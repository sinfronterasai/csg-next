import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { markdownToPortableText, type PortableImage } from "@/lib/blog/portableText";
import { submissionAuth } from "@/lib/blog/submissionAuth";
import { validateSubmission } from "@/lib/blog/submissionValidation";
import { BodyTooLarge, readLimitedBody } from "@/lib/blog/limitedBody";
import { assertSanityWriteConfigured, sanityWriteClient } from "@/lib/sanity/write";
import { submissionEditorial } from "@/lib/blog/submissionEditorial";

const MAX_BODY = 1024 * 1024;
class Rejection extends Error {
  constructor(public status: number, public outcome: string) { super(outcome); }
}

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

// A completed Sanity write may outlive a failed PostgreSQL transaction. Only
// recover if every field we wrote still exactly matches, and no review exists.
function matchesPending(current: any, expected: Record<string, any>): boolean {
  return !!current && !current.review && Object.keys(expected).every(k => canonical(current[k]) === canonical(expected[k]));
}

export async function POST(request: Request) {
  const auth = submissionAuth(request);
  if (auth !== "ok") return NextResponse.json({ error: auth === "unconfigured" ? "Submission service not configured" : "Unauthorized" }, { status: auth === "unconfigured" ? 503 : 401 });
  try { assertSanityWriteConfigured(); } catch { return NextResponse.json({ error: "Sanity write not configured" }, { status: 503 }); }
  let raw: string;
  try { raw = (await readLimitedBody(request, MAX_BODY)).toString("utf8"); }
  catch (error) { return NextResponse.json({ error: error instanceof BodyTooLarge ? "Package too large" : "Unable to read package" }, { status: error instanceof BodyTooLarge ? 413 : 400 }); }
  let p: any;
  try { p = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON" }, { status: 400 }); }
  const errors = validateSubmission(p);
  if (errors.length) return NextResponse.json({ ok: false, outcome: "validation_failed", errors }, { status: 422 });
  const digest = createHash("sha256").update(raw).digest("hex");
  const sanityId = `drafts.csg-submission-${p.submissionId}`;
  try {
    // Resolve references before any mutation; do not silently invent or substitute them.
    const [category, assets, tags] = await Promise.all([
      sanityWriteClient.fetch(`*[_type == "category" && slug.current == $slug][0]{_id}`, { slug: p.category }),
      sanityWriteClient.fetch(`*[_type == "sanity.imageAsset" && _id in $ids]{_id,metadata{dimensions{width,height}}}`, { ids: p.images.map((i: any) => i.assetId) }),
      sanityWriteClient.fetch(`*[_type == "tag" && slug.current in $slugs]{_id,"slug":slug.current}`, { slugs: p.tags || [] }),
    ]);
    if (!category?._id) throw new Rejection(422, "unknown_category");
    const byAsset = new Map<string, any>(assets.map((a: any) => [a._id, a]));
    for (const image of p.images) {
      const asset: any = byAsset.get(image.assetId);
      if (!asset) throw new Rejection(422, "unknown_asset");
      const d = asset.metadata?.dimensions;
      if (!d || (image.role === "featured" ? d.width < 1200 || d.height < 630 : Math.max(d.width, d.height) < 1200)) throw new Rejection(422, "image_too_small");
    }
    const byTag = new Map<string, string>(tags.map((t: any) => [t.slug, t._id]));
    const inline: Record<string, PortableImage> = {};
    const imageObject = (i: any): PortableImage => ({ _type: "image", _key: `img-${i.key}`, asset: { _type: "reference", _ref: i.assetId }, alt: i.alt, ...(i.caption ? { caption: i.caption } : {}) });
    for (const i of p.images.filter((v: any) => v.role === "inline")) inline[i.key] = imageObject(i);
    const featured = imageObject(p.images.find((v: any) => v.role === "featured"));
    const { _key: _unused, ...featuredImage } = featured;
    const body = markdownToPortableText(p.body, inline);
    const wordCount = p.body.replace(/^\[\[image:[a-z0-9-]+\]\]$/gm, "").split(/\s+/).filter(Boolean).length;
    const doc = { _type: "blogPost", title: p.title, slug: { _type: "slug", current: p.slug }, excerpt: p.excerpt, content: body, status: "draft", category: { _type: "reference", _ref: category._id }, tags: (p.tags || []).filter((t: string) => byTag.has(t)).map((t: string, n: number) => ({ _type: "reference", _key: `tag-${n}`, _ref: byTag.get(t) })), author: p.author || "Cosmic Spirit Guide", metaTitle: p.metaTitle, seoTitle: p.metaTitle, metaDescription: p.metaDescription, featuredImage, wordCount, readingTime: Math.max(1, Math.round(wordCount / 220)), csgSubmissionId: p.submissionId, csgSubmissionRevision: p.revision, csgSubmissionHash: digest, ...submissionEditorial(p) };
    const result = await transaction(async (sql) => {
      await sql("BEGIN");
      try {
        await sql("SELECT pg_advisory_xact_lock(hashtext($1))", [`csg-submission:${p.submissionId}`]);
        await sql("SELECT pg_advisory_xact_lock(hashtext($1))", [`csg-slug:${p.slug}`]);
        const prior = (await sql("SELECT * FROM content_submissions WHERE submission_id=$1 FOR UPDATE", [p.submissionId])).rows[0];
        if (prior && p.revision === prior.revision) {
          if (prior.body_sha256 !== digest) throw new Rejection(409, "revision_body_mismatch");
          await sql("COMMIT");
          return { status: 200, body: { ...prior.receipt, outcome: "already_submitted" } };
        }
        if (prior && p.revision < prior.revision) throw new Rejection(409, "stale_revision");
        if (prior && p.slug !== prior.slug) throw new Rejection(409, "slug_immutable");
        if (prior && p.baseRevision !== prior.revision) throw new Rejection(409, "stale_base_revision");
        if (!prior && p.revision !== 1) throw new Rejection(409, "missing_first_revision");
        if (prior && (p.calendarId ?? null) !== (prior.calendar_id ?? null)) throw new Rejection(409, "calendar_immutable");
        if (prior) {
          const stored = (await sql("SELECT * FROM blog_posts WHERE id=$1 FOR UPDATE", [prior.post_id])).rows[0];
          const prev = prior.package;
          const oldFeatured = prev.images.find((i: any) => i.role === "featured")?.assetId;
          if (!stored || stored.status !== "draft" || stored.title !== prev.title || stored.slug !== prev.slug || stored.excerpt !== prev.excerpt || stored.content !== prev.body || stored.featured_image !== oldFeatured || stored.category !== prev.category || stored.meta_title !== prev.metaTitle || stored.meta_description !== prev.metaDescription || JSON.stringify(stored.tags || []) !== JSON.stringify(prev.tags || [])) throw new Rejection(409, "database_post_modified");
        }
        if (!prior) {
          const existing = await sql("SELECT id FROM blog_posts WHERE slug=$1", [p.slug]);
          const saneSlug = await sanityWriteClient.fetch(`count(*[_type == "blogPost" && slug.current == $slug && _id != $id])`, { slug: p.slug, id: sanityId });
          if (existing.rows.length || saneSlug) throw new Rejection(409, "slug_conflict");
        }
        if (p.calendarId) {
          const cal = (await sql("SELECT id,status,post_id FROM content_calendar WHERE id=$1 FOR UPDATE", [p.calendarId])).rows[0];
          if (!cal) throw new Rejection(422, "unknown_calendar_id");
          if (cal.status === "published") throw new Rejection(409, "calendar_closed");
          if (cal.post_id && cal.post_id !== prior?.post_id) throw new Rejection(409, "calendar_conflict");
          if (!cal.post_id && cal.status !== "planned") throw new Rejection(409, "calendar_conflict");
        }
        const publishedId = sanityId.replace(/^drafts\./, "");
        const [current, published] = await Promise.all([sanityWriteClient.getDocument(sanityId), sanityWriteClient.getDocument(publishedId)]);
        if (published) throw new Rejection(409, "already_published");
        let written: any;
        if (!prior) {
          if (current) {
            if (!matchesPending(current, doc)) throw new Rejection(409, "sanity_document_exists_reconcile");
            written = current;
          } else written = await sanityWriteClient.create({ _id: sanityId, ...doc });
        } else {
          if (!current || current.status !== "draft") throw new Rejection(409, "editor_modified");
          if (current._rev !== prior.sanity_revision) {
            if (!matchesPending(current, doc)) throw new Rejection(409, "editor_modified");
            written = current;
          } else {
            const { _type: _type, ...fields } = doc;
            written = await sanityWriteClient.patch(sanityId).ifRevisionId(prior.sanity_revision).set(fields).unset(["review"]).commit();
          }
        }
        const readback: any = await sanityWriteClient.getDocument(sanityId);
        if (!readback || readback._rev !== written._rev || readback.status !== "draft") throw new Error("Sanity verification failed");
        const args = [p.title, p.slug, p.excerpt, p.body, p.images.find((i: any) => i.role === "featured").assetId, p.tags || [], p.category, p.metaTitle, p.metaDescription, doc.readingTime];
        const row = prior
          ? (await sql("UPDATE blog_posts SET title=$1,slug=$2,excerpt=$3,content=$4,featured_image=$5,tags=$6,category=$7,meta_title=$8,meta_description=$9,reading_time=$10,status='draft',sanity_id=$11,sanity_synced_at=now(),updated_at=now() WHERE id=$12 AND status='draft' RETURNING id", [...args, sanityId, prior.post_id])).rows[0]
          : (await sql("INSERT INTO blog_posts (title,slug,excerpt,content,featured_image,tags,category,meta_title,meta_description,reading_time,status,sanity_id,sanity_synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,now()) RETURNING id", [...args, sanityId])).rows[0];
        if (!row) throw new Rejection(409, "database_post_modified");
        if (p.calendarId && !prior) await sql("UPDATE content_calendar SET post_id=$1,status='drafting',updated_at=now() WHERE id=$2", [row.id, p.calendarId]);
        const receipt = { ok: true, outcome: prior ? "revision_applied" : "draft_created", submissionId: p.submissionId, revision: p.revision, postId: row.id, sanityId, sanityRevision: readback._rev, status: "draft", unresolvedTags: (p.tags || []).filter((t: string) => !byTag.has(t)), openQuestions: p.openQuestions || [] };
        if (prior) {
          await sql("UPDATE content_submissions SET revision=$2,body_sha256=$3,package=$4,state='complete',sanity_revision=$5,receipt=$6,updated_at=now() WHERE submission_id=$1 AND revision=$7", [p.submissionId,p.revision,digest,JSON.stringify(p),readback._rev,JSON.stringify(receipt),p.baseRevision]);
        } else {
          await sql("INSERT INTO content_submissions (submission_id,slug,revision,body_sha256,package,state,post_id,calendar_id,sanity_id,sanity_revision,receipt) VALUES ($1,$2,$3,$4,$5,'complete',$6,$7,$8,$9,$10)", [p.submissionId,p.slug,p.revision,digest,JSON.stringify(p),row.id,p.calendarId || null,sanityId,readback._rev,JSON.stringify(receipt)]);
        }
        await sql("INSERT INTO content_submission_revisions (submission_id,revision,body_sha256,package,receipt) VALUES ($1,$2,$3,$4,$5)", [p.submissionId,p.revision,digest,JSON.stringify(p),JSON.stringify(receipt)]);
        await sql("COMMIT");
        return { status: prior ? 200 : 201, body: receipt };
      } catch (error) { await sql("ROLLBACK"); throw error; }
    });
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    if (error instanceof Rejection) return NextResponse.json({ ok: false, outcome: error.outcome }, { status: error.status });
    if (error?.statusCode === 409 || error?.code === "23505") return NextResponse.json({ ok: false, outcome: "write_conflict" }, { status: 409 });
    console.error("[content/submissions] failed", { submissionId: p.submissionId, error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ ok: false, outcome: "submission_failed_reconcile_before_retry" }, { status: 500 });
  }
}
