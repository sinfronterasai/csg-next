import { sanityImageUrl, safeAlt, type SanityImageSource } from "@/lib/sanity/image";

export interface BlogImage {
  url: string | null;
  alt: string;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  readingTime: number;
  category: string | null;
  featuredImage: BlogImage;
}

export interface PortableTextImage extends BlogImage {
  _key: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  readingTime: number;
  wordCount: number;
  category: string | null;
  featuredImage: BlogImage;
  content: unknown[];
  faqSection: { question: string; answer: string }[];
  seo: {
    seoTitle: string;
    metaDescription: string;
    canonicalUrl: string | null;
    robots: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string | null;
    ogType: string;
    ogUrl: string | null;
    ogSiteName: string;
    twitterCard: string;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string | null;
    twitterSite: string | null;
    schemaJson: string | null;
    faqSchema: string | null;
  };
  geo: {
    about: string | null;
    summary: string | null;
    entityType: string | null;
    keyEntities: string[];
    citeSources: string[];
  };
}

function toBlogImage(raw: SanityImageSource | null | undefined, fallback: string): BlogImage {
  return {
    url: sanityImageUrl(raw, { width: 1200, quality: 80 }),
    alt: safeAlt(raw, fallback),
  };
}

export function transformPost(raw: any, baseUrl: string): BlogPost {
  const title = raw?.title ?? "Untitled";
  const slug = raw?.slug?.current ?? raw?.slug ?? "";
  const fallbackAlt = `${title} — Cosmic Spirit Guide`;

  const featuredImage = toBlogImage(raw?.featuredImage, fallbackAlt);

  const content: unknown[] = Array.isArray(raw?.content) ? raw.content : [];
  // Guarantee every inline image has a resolvable URL + non-empty alt.
  const normalizedContent = content.map((block: any) => {
    if (block?._type === "image") {
      return {
        ...block,
        _resolved: toBlogImage(block as SanityImageSource, fallbackAlt),
      };
    }
    return block;
  });

  const faqSection = Array.isArray(raw?.faqSection)
    ? raw.faqSection
        .filter((f: any) => f?.question && f?.answer)
        .map((f: any) => ({ question: f.question, answer: f.answer }))
    : [];

  const seo = {
    seoTitle: raw?.seoTitle ?? title,
    metaDescription: raw?.metaDescription ?? raw?.excerpt ?? "",
    canonicalUrl: raw?.canonicalUrl ?? (slug ? `${baseUrl}/blog/${slug}` : null),
    robots: raw?.robots ?? "index, follow",
    ogTitle: raw?.ogTitle ?? raw?.seoTitle ?? title,
    ogDescription: raw?.ogDescription ?? raw?.metaDescription ?? raw?.excerpt ?? "",
    ogImage: raw?.ogImage ?? featuredImage.url,
    ogType: raw?.ogType ?? "article",
    ogUrl: raw?.ogUrl ?? (slug ? `${baseUrl}/blog/${slug}` : null),
    ogSiteName: raw?.ogSiteName ?? "Cosmic Spirit Guide",
    twitterCard: raw?.twitterCard ?? "summary_large_image",
    twitterTitle: raw?.twitterTitle ?? raw?.ogTitle ?? title,
    twitterDescription: raw?.twitterDescription ?? raw?.ogDescription ?? "",
    twitterImage: raw?.twitterImage ?? raw?.ogImage ?? featuredImage.url,
    twitterSite: raw?.twitterSite ?? null,
    schemaJson: raw?.schemaJson ?? null,
    faqSchema: raw?.faqSchema ?? null,
  };

  const geo = {
    about: raw?.geoAbout ?? null,
    summary: raw?.geoSummary ?? null,
    entityType: raw?.geoEntityType ?? null,
    keyEntities: Array.isArray(raw?.geoKeyEntities) ? raw.geoKeyEntities : [],
    citeSources: Array.isArray(raw?.geoCiteSources)
      ? raw.geoCiteSources.map((s: any) => (typeof s === "string" ? s : s?.url || s?.title || "")).filter(Boolean)
      : [],
  };

  return {
    id: raw?._id ?? slug,
    title,
    slug,
    excerpt: raw?.excerpt ?? "",
    author: raw?.author ?? "Cosmic Spirit Guide",
    publishedAt: raw?.publishedAt ?? raw?._createdAt ?? "",
    updatedAt: raw?.updatedAt,
    readingTime: raw?.readingTime ?? 0,
    wordCount: raw?.wordCount ?? 0,
    category: raw?.category ?? null,
    featuredImage,
    content: normalizedContent,
    faqSection,
    seo,
    geo,
  };
}

export function transformList(raw: any[]): BlogPostListItem[] {
  return (raw ?? []).map((p) => {
    const title = p?.title ?? "Untitled";
    const slug = p?.slug?.current ?? p?.slug ?? "";
    return {
      id: p?._id ?? slug,
      title,
      slug,
      excerpt: p?.excerpt ?? "",
      author: p?.author ?? "Cosmic Spirit Guide",
      publishedAt: p?.publishedAt ?? p?._createdAt ?? "",
      readingTime: p?.readingTime ?? 0,
      category: p?.category ?? null,
      featuredImage: toBlogImage(p?.featuredImage, `${title} — Cosmic Spirit Guide`),
    };
  });
}
