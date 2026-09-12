import { sanityClient } from "@/lib/sanity/client";

// B11 — Fail-closed publication contract.
//
// Public queries MUST require BOTH:
//   1. status == "published"            (the lifecycle flag), AND
//   2. review.status == "approved"      (independent editorial approval)
// plus minimum content integrity (defined slug/title/body/publishedAt) and
// exclusion of test/system documents (slug starting with "__").
//
// Any document missing review approval, or any test record, is invisible through
// every public surface: list, latest, direct slug, static params, and sitemap.
// This code does NOT mutate the production dataset; it only tightens the query.

const PUB_FIELDS = `
  _id,
  title,
  slug,
  excerpt,
  author,
  publishedAt,
  readingTime,
  wordCount,
  status,
  review,
  "category": category->name,
  featuredImage,
  content,
  faqSection,
  seoTitle,
  metaDescription,
  canonicalUrl,
  robots,
  ogTitle,
  ogDescription,
  ogImage,
  ogType,
  ogUrl,
  ogSiteName,
  twitterCard,
  twitterTitle,
  twitterDescription,
  twitterImage,
  twitterSite,
  schemaJson,
  faqSchema,
  geoAbout,
  geoSummary,
  geoEntityType,
  geoKeyEntities,
  geoCiteSources
`;

// Shared fail-closed predicate. Mirrors the verified Sanity approval gate.
// Test/system documents (slug starting with "__") are excluded via the wildcard match.
// `content` is Portable Text (an array), so it is validated with count() > 0, not a string compare.
const APPROVED_PREDICATE = `
  status == "published"
  && review.status == "approved"
  && count(coalesce(review.hardFailFlags, [])) == 0
  && defined(slug.current)
  && !(slug.current match "__*")
  && defined(title)
  && count(content) > 0
  && defined(publishedAt)
`;

export const POSTS_LIST_QUERY = `*[_type == "blogPost" && ${APPROVED_PREDICATE}] | order(publishedAt desc){${PUB_FIELDS}}`;

export const ALL_POST_SLUGS_QUERY = `*[_type == "blogPost" && ${APPROVED_PREDICATE}].slug.current`;

export const LATEST_POST_QUERY = `*[_type == "blogPost" && ${APPROVED_PREDICATE}] | order(publishedAt desc)[0]{${PUB_FIELDS}}`;

// Direct slug lookup must ALSO fail closed: a known slug can never render a
// draft, review item, rejected/held record, test doc, or malformed record.
export const POST_BY_SLUG_QUERY = `*[_type == "blogPost" && slug.current == $slug && ${APPROVED_PREDICATE}][0]{${PUB_FIELDS}}`;

export async function fetchPublishedPosts() {
  return sanityClient.fetch(POSTS_LIST_QUERY);
}

export async function fetchPostBySlug(slug: string) {
  return sanityClient.fetch(POST_BY_SLUG_QUERY, { slug });
}

export async function fetchLatestPost() {
  return sanityClient.fetch(LATEST_POST_QUERY);
}

export async function fetchAllPostSlugs(): Promise<string[]> {
  return sanityClient.fetch(ALL_POST_SLUGS_QUERY);
}
