export const SANITY_CDN = "https://cdn.sanity.io/images";

export interface SanityImageSource {
  _type: "image";
  alt?: string | null;
  asset?: { _ref?: string; _type?: string } | null;
}

function assetRefToPath(ref: string): string | null {
  const m = ref.match(/^image-([a-f0-9]+)-(\d+)x(\d+)(?:-(\w+))?$/);
  if (!m) return null;
  const [, hash, w, h, ext] = m;
  return `${hash}-${w}x${h}${ext ? "." + ext : ""}`;
}

export function sanityImageUrl(
  image: SanityImageSource | null | undefined,
  opts: { width?: number; height?: number; quality?: number } = {},
): string | null {
  if (!image?.asset?._ref) return null;
  const path = assetRefToPath(image.asset._ref);
  if (!path) return null;
  const projectId = process.env.SANITY_PROJECT_ID || "kicslgfz";
  const dataset = process.env.SANITY_DATASET || "production";
  const params = new URLSearchParams();
  if (opts.width) params.set("w", String(opts.width));
  if (opts.height) params.set("h", String(opts.height));
  params.set("q", String(opts.quality ?? 80));
  params.set("auto", "format");
  const qs = params.toString();
  return `${SANITY_CDN}/${projectId}/${dataset}/${path}${qs ? "?" + qs : ""}`;
}

export function safeAlt(
  image: SanityImageSource | null | undefined,
  fallback: string,
): string {
  const raw = (image?.alt || "").toString().trim();
  return raw.length > 0 ? raw : fallback;
}
