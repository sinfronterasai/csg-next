import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let db: PGlite;
let failNextInsert = false;
let failNextUpdate = false;
const docs = new Map<string, any>();
let rev = 0;
jest.mock("@/lib/db", () => ({ transaction: (fn: any) => fn(async (sql: string, args?: any[]) => {
  if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
  if (failNextInsert && sql.startsWith("INSERT INTO blog_posts")) { failNextInsert = false; throw new Error("simulated database outage"); }
  if (failNextUpdate && sql.startsWith("UPDATE blog_posts SET")) { failNextUpdate = false; throw new Error("simulated database outage"); }
  const result = await db.query(sql, args); return { rows: result.rows, rowCount: result.affectedRows };
}) }));
jest.mock("@/lib/sanity/write", () => ({ assertSanityWriteConfigured: () => {}, sanityWriteClient: {
  fetch: async (q: string, params: any) => {
    if (q.includes('category')) return { _id: 'category-astrology' };
    if (q.includes('imageAsset')) return params.ids.map((id: string) => ({ _id: id, metadata: { dimensions: { width: 1400, height: 900 } } }));
    if (q.includes('tag')) return [];
    if (q.includes('count(')) return 0;
  },
  getDocument: async (id: string) => docs.get(id) || null,
  create: async (doc: any) => { if (docs.has(doc._id)) throw new Error('exists'); const d = { ...doc, _rev: `r${++rev}` }; docs.set(doc._id, d); return d; },
  patch: (id: string) => { let expected = '', fields: any; return { ifRevisionId(r: string) { expected = r; return this; }, set(d: any) { fields = d; return this; }, unset() { return this; }, async commit() { const old = docs.get(id); if (old._rev !== expected) throw Object.assign(new Error('conflict'), { statusCode: 409 }); const d = { ...old, ...fields, _rev: `r${++rev}` }; delete d.review; docs.set(id, d); return d; } }; },
} }));
import { POST } from "@/app/api/content/submissions/route";

const review = { status: "pass", reviewer: "Reviewer", reviewedAt: "2026-11-24T19:30:00Z", notes: "Checked" };
const image = (key: string, role: string) => ({ key, role, assetId: `image-${"a".repeat(40)}-1400x900-jpg`, alt: `Illustration ${key}`, rights: { source: "CSG", license: "owned" } });
const makePackage = () => ({ schemaVersion: "1.1", submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8D", revision: 1, baseRevision: null as number | null, submittedAt: "2026-11-24T20:15:00Z", calendarId: 1, title: "Test article", slug: "test-article", excerpt: "Excerpt", body: "## First\nText [link](/birth-chart)\n[[image:first]]\n## Second\nText\n[[image:second]]", category: "astrology", primaryKeyword: "test", metaTitle: "Test", metaDescription: "Description", images: [image("featured", "featured"), image("first", "inline"), image("second", "inline")], claims: [], sources: [], reviews: { editorial: review, factCheck: review, culture: review, accessibility: review, images: review } });
const request = (body: unknown) => new Request("https://example.test", { method: "POST", headers: { authorization: "Bearer test-secret", "content-type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => {
  process.env.CSG_CONTENT_SUBMISSION_TOKEN = "test-secret";
  db = new PGlite();
  await db.exec(`CREATE TABLE blog_posts (id serial primary key, title text, slug text unique, excerpt text, content text, featured_image text, tags text[], category text, meta_title text, meta_description text, reading_time integer, status text, sanity_id text, sanity_synced_at timestamptz, updated_at timestamptz);
    CREATE TABLE content_calendar (id serial primary key, status text, post_id integer, updated_at timestamptz);
    INSERT INTO content_calendar (status) VALUES ('planned');`);
  await db.exec(readFileSync(join(process.cwd(), "src/lib/blog/submission-migration.sql"), "utf8"));
});
afterAll(async () => { delete process.env.CSG_CONTENT_SUBMISSION_TOKEN; await db.close(); });
it("creates a draft once, preserves links and images, and rejects an editor conflict", async () => {
  const p = makePackage();
  const created = await POST(request(p));
  expect(created.status).toBe(201);
  const receipt = await created.json();
  expect(receipt.status).toBe("draft");
  const doc = docs.get(receipt.sanityId);
  expect(doc.featuredImage.asset._ref).toBe(p.images[0].assetId);
  expect(doc.content.filter((b: any) => b._type === "image")).toHaveLength(2);
  expect(doc.content.some((b: any) => b.markDefs?.some((m: any) => m.href === "/birth-chart"))).toBe(true);
  expect((await POST(request(p))).status).toBe(200);
  expect((await db.query("SELECT count(*)::int AS count FROM blog_posts")).rows[0]).toEqual({ count: 1 });
  const revision = { ...p, revision: 2, baseRevision: 1, title: "Team revision" };
  expect((await POST(request(revision))).status).toBe(200);
  expect(docs.get(receipt.sanityId).title).toBe("Team revision");
  docs.set(receipt.sanityId, { ...docs.get(receipt.sanityId), title: "Editor changed this", _rev: "editor-rev" });
  const update = { ...p, revision: 3, baseRevision: 2, title: "Next team revision" };
  const conflict = await POST(request(update));
  expect(conflict.status).toBe(409);
  expect((await conflict.json()).outcome).toBe("editor_modified");
  expect(docs.get(receipt.sanityId).title).toBe("Editor changed this");
});
it("rejects a blocked cultural review without writes", async () => {
  const p = { ...makePackage(), submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8E", slug: "other", calendarId: null, reviews: { ...makePackage().reviews, culture: { ...review, status: "block" } } };
  const response = await POST(request(p));
  expect(response.status).toBe(422);
  expect((await db.query("SELECT count(*)::int AS count FROM blog_posts")).rows[0]).toEqual({ count: 1 });
});
it("recovers a matching Sanity write after a database failure without creating a second document", async () => {
  const p = { ...makePackage(), submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8F", slug: "recoverable-article", calendarId: null };
  failNextInsert = true;
  expect((await POST(request(p))).status).toBe(500);
  const id = `drafts.csg-submission-${p.submissionId}`;
  const oldRev = docs.get(id)._rev;
  const retry = await POST(request(p));
  expect(retry.status).toBe(201);
  expect(docs.get(id)._rev).toBe(oldRev);
  expect((await db.query("SELECT count(*)::int AS count FROM blog_posts WHERE slug=$1", [p.slug])).rows[0]).toEqual({ count: 1 });
});
it("does not overwrite a published counterpart", async () => {
  const p = { ...makePackage(), submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8G", slug: "published-article", calendarId: null };
  const publishedId = `csg-submission-${p.submissionId}`;
  docs.set(publishedId, { _id: publishedId, status: "published", title: "Existing published article" });
  const response = await POST(request(p));
  expect(response.status).toBe(409);
  expect((await response.json()).outcome).toBe("already_published");
  expect(docs.get(publishedId).title).toBe("Existing published article");
  expect(docs.has(`drafts.${publishedId}`)).toBe(false);
});
it("recovers a revision after Sanity succeeds but the database rolls back", async () => {
  const p = { ...makePackage(), submissionId: "01JCX8Q2M4T9VK3B7N5R0W6Y8H", slug: "recoverable-revision", calendarId: null };
  const first = await POST(request(p)); expect(first.status).toBe(201);
  const id = (await first.json()).sanityId;
  const revision = { ...p, revision: 2, baseRevision: 1, title: "Corrected title" };
  failNextUpdate = true;
  expect((await POST(request(revision))).status).toBe(500);
  const written = docs.get(id)._rev;
  const retry = await POST(request(revision));
  expect(retry.status).toBe(200);
  expect(docs.get(id)._rev).toBe(written);
  expect((await db.query("SELECT title FROM blog_posts WHERE slug=$1", [p.slug])).rows[0]).toEqual({ title: "Corrected title" });
});
