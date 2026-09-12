// JSON-LD builders + the single correct escapeJsonLd. Replaces the buggy copy in
// src/lib/blog/breadcrumb.ts (which replaced U+2028 with itself - a no-op).
export type JsonLdObject = {
  [key: string]: unknown;
  "@type": string;
  "@context"?: string;
};

export function escapeJsonLd(json: string): string {
  return json
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

const CTX = "https://schema.org";

function ok(s: unknown): boolean {
  if (!s) return false;
  const str = s as string;
  if (!str.trim) return false;
  return str.trim().length > 0;
}

export function organizationJsonLd(opts?: {
  name?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}): JsonLdObject {
  const o = opts || {};
  const url = o.url || "https://cosmicspiritguide.com";
  const out: JsonLdObject = {
    "@context": CTX,
    "@type": "Organization",
    name: o.name || "Cosmic Spirit Guide",
    url: url,
  };
  if (o) {
    if (o.logo) out.logo = o.logo;
  }
  out.sameAs = o.sameAs || [];
  return out;
}

export function websiteJsonLd(opts?: { name?: string; url?: string }): JsonLdObject {
  const o = opts || {};
  const url = o.url || "https://cosmicspiritguide.com";
  return {
    "@context": CTX,
    "@type": "WebSite",
    name: o.name || "Cosmic Spirit Guide",
    url: url,
  };
}

export interface ArticleJsonLdInput {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  publisher?: string;
}

export function articleJsonLd(a: ArticleJsonLdInput): JsonLdObject {
  const out: JsonLdObject = {
    "@context": CTX,
    "@type": "BlogPosting",
    headline: a.headline,
    description: a.description,
    url: a.url,
  };
  if (a.image) out.image = a.image;
  if (a.datePublished) out.datePublished = a.datePublished;
  if (a.dateModified) out.dateModified = a.dateModified;
  out.author = a.author ? { "@type": "Person", name: a.author } : undefined;
  out.publisher = a.publisher
    ? { "@type": "Organization", name: a.publisher }
    : { "@type": "Organization", name: "Cosmic Spirit Guide" };
  return out;
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: "https://cosmicspiritguide.com" + c.path,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

// FAQPage ONLY when a visible FAQ exists on the page.
export function faqPageJsonLd(items: FaqItem[] | undefined): JsonLdObject | null {
  const list = items || [];
  const valid = list.filter((it) => {
    if (!it) return false;
    if (!ok(it.question)) return false;
    if (!ok(it.answer)) return false;
    return true;
  });
  if (valid.length === 0) return null;
  return {
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: valid.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

export function webApplicationJsonLd(opts?: {
  name?: string;
  url?: string;
  description?: string;
  applicationCategory?: string;
}): JsonLdObject | null {
  if (!opts) return null;
  if (!opts.description) return null;
  const out: JsonLdObject = {
    "@context": CTX,
    "@type": "WebApplication",
    name: opts.name || "Cosmic Spirit Guide",
    url: opts.url || "https://cosmicspiritguide.com",
    description: opts.description,
    applicationCategory: opts.applicationCategory || "LifestyleApplication",
    operatingSystem: "Web",
  };
  return out;
}

export function mergeJsonLd(...schemas: (JsonLdObject | null)[]): JsonLdObject[] {
  return schemas.filter((s): s is JsonLdObject => !!s);
}
