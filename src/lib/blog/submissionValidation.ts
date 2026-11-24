export type SubmissionError = { path: string; code: string; message: string };
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPattern = /^image-[a-f0-9]{40}-\d+x\d+-(?:jpg|png|webp)$/;

// Validate the entire package before any database or Sanity mutation.
export function validateSubmission(value: unknown): SubmissionError[] {
  const errors: SubmissionError[] = [];
  const add = (path: string, message: string) => errors.push({ path, code: "invalid", message });
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ path: "$", code: "invalid", message: "Expected an object" }];
  const p = value as Record<string, any>;
  const required = (name: string, max: number) => {
    if (typeof p[name] !== "string" || !p[name].trim() || p[name].length > max) add(name, `Required string, maximum ${max} characters`);
  };
  if (p.schemaVersion !== "1.1") add("schemaVersion", "Expected 1.1");
  if (typeof p.submissionId !== "string" || !ULID.test(p.submissionId)) add("submissionId", "Expected a valid ULID");
  if (!Number.isSafeInteger(p.revision) || p.revision < 1) add("revision", "Expected a positive integer");
  if ((p.revision === 1 && p.baseRevision != null) || (p.revision > 1 && (!Number.isSafeInteger(p.baseRevision) || p.baseRevision < 1 || p.baseRevision >= p.revision))) add("baseRevision", "Invalid base revision");
  if (typeof p.submittedAt !== "string" || !Number.isFinite(Date.parse(p.submittedAt))) add("submittedAt", "Expected a date-time");
  if (p.calendarId != null && (!Number.isSafeInteger(p.calendarId) || p.calendarId < 1)) add("calendarId", "Expected a positive integer");
  if (p.author != null && (typeof p.author !== "string" || !p.author.trim() || p.author.length > 120)) add("author", "Expected an author name up to 120 characters");
  for (const [name, max] of Object.entries({ title: 120, slug: 96, excerpt: 300, body: 100000, category: 96, primaryKeyword: 200, metaTitle: 60, metaDescription: 160 })) required(name, max);
  const testSlug = p.testOnly === true && typeof p.slug === "string" && /^__test-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug);
  if (p.testOnly != null && typeof p.testOnly !== "boolean") add("testOnly", "Expected a boolean");
  if (typeof p.slug === "string" && !slugPattern.test(p.slug) && !testSlug) add("slug", "Use lowercase letters, numbers and single hyphens");
  if (p.testOnly === true && !testSlug) add("slug", "Test submissions must use a __test- slug");
  if (typeof p.category === "string" && !slugPattern.test(p.category)) add("category", "Expected a category slug");
  if (p.tags != null && (!Array.isArray(p.tags) || p.tags.length > 8 || p.tags.some((v: unknown) => typeof v !== "string" || !slugPattern.test(v)))) add("tags", "Expected at most eight tag slugs");
  const markers = typeof p.body === "string" ? [...p.body.matchAll(/^\[\[image:([a-z0-9-]+)\]\]$/gm)].map(x => x[1]) : [];
  if (typeof p.body === "string" && (/^\s*(?:---+|\|.*\|)\s*$/m.test(p.body) || /`|!\[|^\s{2,}(?:[-*]|\d+\.)\s/m.test(p.body))) add("body", "Contains unsupported Markdown");
  const images = Array.isArray(p.images) ? p.images : [];
  const wordCount = typeof p.body === "string" ? p.body.replace(/^\[\[image:[a-z0-9-]+\]\]$/gm, "").split(/\s+/).filter(Boolean).length : 0;
  const minimumInline = Math.max(1, Math.min(4, Math.ceil(wordCount / 500)));
  const inlineCount = images.filter((i: any) => i?.role === "inline").length;
  if (images.length > 5 || images.filter((i: any) => i?.role === "featured").length !== 1 || inlineCount < minimumInline || inlineCount > 4) add("images", `Require one featured image and ${minimumInline} to four inline images for this length`);
  const keys = new Set<string>();
  images.forEach((i: any, n: number) => {
    const path = `images[${n}]`;
    if (!i || typeof i !== "object") { add(path, "Expected an image object"); return; }
    if (typeof i.key !== "string" || !slugPattern.test(i.key) || keys.has(i.key)) add(`${path}.key`, "Expected a unique key"); else keys.add(i.key);
    if (!["featured", "inline"].includes(i.role)) add(`${path}.role`, "Expected featured or inline");
    if (typeof i.assetId !== "string" || !assetPattern.test(i.assetId)) add(`${path}.assetId`, "Expected a Sanity image asset ID");
    if (typeof i.alt !== "string" || !i.alt.trim() || i.alt.length > 200 || /^image of\b/i.test(i.alt)) add(`${path}.alt`, "Provide descriptive alt text up to 200 characters");
    if (i.caption != null && (typeof i.caption !== "string" || i.caption.length > 200 || i.caption.trim() === i.alt?.trim())) add(`${path}.caption`, "Caption must differ from alt text and fit 200 characters");
    if (!i.rights || typeof i.rights.source !== "string" || !i.rights.source.trim() || !["owned", "licensed", "public-domain", "cc-by", "cc-by-sa", "cc0"].includes(i.rights.license)) add(`${path}.rights`, "Provide source and permitted license");
    if (i.rights?.license !== "owned" && (typeof i.rights?.sourceUrl !== "string" || !/^https:\/\//i.test(i.rights.sourceUrl))) add(`${path}.rights.sourceUrl`, "A source URL is required");
    if (i.role === "inline" && markers.filter(k => k === i.key).length !== 1) add(`${path}.key`, "Inline image must appear exactly once in the body");
    if (i.role === "featured" && markers.includes(i.key)) add(`${path}.key`, "Featured image cannot appear as an inline marker");
  });
  if (markers.some(k => !images.some((i: any) => i?.key === k && i?.role === "inline"))) add("body", "Image marker has no matching inline image");
  if (typeof p.body === "string" && p.body.includes("[[image:") && (p.body.match(/\[\[image:/g) || []).length !== markers.length) add("body", "Image markers must appear alone on a line");
  const reviews = p.reviews && typeof p.reviews === "object" ? p.reviews : {};
  for (const name of ["editorial", "factCheck", "culture", "accessibility", "images"]) {
    const r = reviews[name];
    if (!r || !["pass", "pass-with-changes", "block"].includes(r.status) || typeof r.reviewer !== "string" || !r.reviewer.trim() || typeof r.notes !== "string" || !r.notes.trim() || !Number.isFinite(Date.parse(r.reviewedAt))) add(`reviews.${name}`, "Complete review required");
    else if (r.status !== "pass") add(`reviews.${name}.status`, "Review must pass before submission");
  }
  const claims = Array.isArray(p.claims) ? p.claims : [];
  const sources = Array.isArray(p.sources) ? p.sources : [];
  if (!Array.isArray(p.claims) || !Array.isArray(p.sources)) add("sources", "Claims and sources arrays are required");
  const claimIds = new Set<string>(), sourceIds = new Set<string>();
  claims.forEach((c: any, n: number) => { if (!c || !/^c\d+$/.test(c.id) || claimIds.has(c.id) || typeof c.text !== "string" || !c.text.trim() || !["sourced", "interpretive", "unverified"].includes(c.status) || !Array.isArray(c.sourceIds)) add(`claims[${n}]`, "Invalid claim"); else claimIds.add(c.id); });
  sources.forEach((s: any, n: number) => { if (!s || !/^s\d+$/.test(s.id) || sourceIds.has(s.id) || typeof s.title !== "string" || !s.title.trim() || typeof s.publisher !== "string" || !s.publisher.trim() || typeof s.url !== "string" || !/^https:\/\//i.test(s.url) || !Number.isFinite(Date.parse(s.accessedAt)) || !Array.isArray(s.supports)) add(`sources[${n}]`, "Invalid source"); else sourceIds.add(s.id); });
  claims.forEach((c: any, n: number) => { if (!c || !Array.isArray(c.sourceIds)) return; if (c.status === "sourced" && !c.sourceIds.length) add(`claims[${n}]`, "Sourced claim requires a source"); if (c.status === "unverified" && p.allowUnverified !== true) add(`claims[${n}]`, "Unverified claim requires explicit flag"); if (c.sourceIds.some((id: string) => !sourceIds.has(id))) add(`claims[${n}].sourceIds`, "Unknown source"); });
  sources.forEach((s: any, n: number) => { if (Array.isArray(s?.supports) && s.supports.some((id: string) => !claimIds.has(id))) add(`sources[${n}].supports`, "Unknown claim"); });
  if (p.openQuestions != null && (!Array.isArray(p.openQuestions) || p.openQuestions.some((v: unknown) => typeof v !== "string"))) add("openQuestions", "Expected an array of strings");
  return errors;
}
