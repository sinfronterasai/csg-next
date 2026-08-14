import { sanityClient } from "@/lib/sanity/client";

// Fetch all published blog posts (lightweight fields for the index).
export const POSTS_LIST_QUERY = `*[_type == "blogPost" && status == "published"] | order(publishedAt desc){
  _id,
  title,
  slug,
  excerpt,
  author,
  publishedAt,
  readingTime,
  "category": category->name,
  featuredImage
}`;

// Fetch a single post by slug with full content.
export const POST_BY_SLUG_QUERY = `*[_type == "blogPost" && slug.current == $slug][0]{
  _id,
  title,
  slug,
  excerpt,
  author,
  publishedAt,
  updatedAt,
  readingTime,
  wordCount,
  status,
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
}`;

export const ALL_POST_SLUGS_QUERY = `*[_type == "blogPost" && status == "published" && defined(slug.current)].slug.current`;

export async function fetchPublishedPosts() {
  return sanityClient.fetch(POSTS_LIST_QUERY);
}

export async function fetchPostBySlug(slug: string) {
  return sanityClient.fetch(POST_BY_SLUG_QUERY, { slug });
}


// Fetch ONLY the single newest published post (brand-new blog start).
export const LATEST_POST_QUERY = `*[_type == "blogPost" && status == "published"] | order(publishedAt desc)[0]{
  _id,
  title,
  slug,
  excerpt,
  author,
  publishedAt,
  readingTime,
  wordCount,
  status,
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
}`;

export async function fetchLatestPost() {
  return sanityClient.fetch(LATEST_POST_QUERY);
}

export async function fetchAllPostSlugs(): Promise<string[]> {
  return sanityClient.fetch(ALL_POST_SLUGS_QUERY);
}
