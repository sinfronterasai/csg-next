import type { Metadata } from "next";
import {
  getActiveBaseUrl,
  isProductionHost,
  resolveCanonicalUrl,
} from "./host";
import type { JsonLdObject } from "./jsonld";

export interface BuildMetadataInput {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  jsonLd?: JsonLdObject | JsonLdObject[];
  noindex?: boolean;
  og?: { title?: string; description?: string; image?: string; type?: string };
  twitter?: {
    title?: string;
    description?: string;
    image?: string;
    card?: "summary" | "summary_large_image";
  };
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  siteName?: string;
  runtime?: { host?: string | null };
}

export interface BuiltMetadata {
  metadata: Metadata;
  jsonLd: JsonLdObject[];
}

function readHostFromHeaders(): string | null {
  try {
    const nh = require("next/headers");
    const h = nh.headers();
    const fwd = h.get("x-forwarded-host");
    if (fwd) return fwd;
    return h.get("host") || null;
  } catch (e) {
    return null;
  }
}

function firstDefined(...vals: (string | undefined)[]): string | undefined {
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v) return v;
  }
  return undefined;
}

export function buildMetadata(input: BuildMetadataInput): BuiltMetadata {
  const rt = input.runtime;
  let host = readHostFromHeaders();
  if (rt) {
    if (rt.host !== undefined) host = rt.host;
  }
  const isProd = isProductionHost(host);
  const canonical = resolveCanonicalUrl(input.path, host);

  // noindex is honored in every environment (e.g. programmatic pages awaiting
  // content-QA must stay out of index until curated — never padded to fake quality).
  const allowIndex = !input.noindex;
  const allowFollow = !input.noindex;

  const jsonLd = Array.isArray(input.jsonLd)
    ? input.jsonLd
    : input.jsonLd
    ? [input.jsonLd]
    : [];

  const og = input.og;
  const tw = input.twitter;
  const ogTitle = og ? og.title : undefined;
  const ogDesc = og ? og.description : undefined;
  const ogImage = og ? og.image : undefined;

  const metaTitle = firstDefined(ogTitle, input.title) || input.title;
  const metaDesc = firstDefined(ogDesc, input.description) || input.description;

  const metadata: Metadata = {
    title: input.title,
    description: input.description,
    metadataBase: new URL(getActiveBaseUrl()),
    alternates: { canonical: canonical },
    robots: { index: allowIndex, follow: allowFollow },
    openGraph: {
      type: input.type || "website",
      url: canonical,
      siteName: input.siteName || "Cosmic Spirit Guide",
      title: metaTitle,
      description: metaDesc,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: tw ? tw.card || "summary_large_image" : "summary_large_image",
      title: firstDefined(tw ? tw.title : undefined, ogTitle, input.title) || input.title,
      description: firstDefined(tw ? tw.description : undefined, ogDesc, input.description) ||
        input.description,
      images: tw ? (tw.image ? [tw.image] : undefined) : undefined,
    },
  };

  if (input.type === "article") {
    const ogOut = metadata.openGraph as Record<string, unknown>;
    if (input.publishedTime) ogOut.publishedTime = input.publishedTime;
    if (input.modifiedTime) ogOut.modifiedTime = input.modifiedTime;
    if (input.authors) ogOut.authors = input.authors;
  }

  return { metadata, jsonLd };
}
