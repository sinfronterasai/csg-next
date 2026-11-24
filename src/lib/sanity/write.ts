import { createClient, type SanityClient } from "@sanity/client";

// Write-scoped Sanity client.
//
// Deliberately separate from `@/lib/sanity/client` (which is read-only and
// CDN-backed). Writes must never go through the CDN and must never fall back to
// a read token, so this client requires an explicit write token.
const projectId = process.env.SANITY_PROJECT_ID || "kicslgfz";
const dataset = process.env.SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN || undefined;

export const sanityWriteClient: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: "2023-05-03",
  useCdn: false,
  token,
  perspective: "raw",
});

export const SANITY_WRITE_PROJECT_ID = projectId;
export const SANITY_WRITE_DATASET = dataset;

/**
 * Fail loudly and specifically when the write token is absent, rather than
 * letting the mutation fail with an opaque 401 from Sanity.
 */
export function assertSanityWriteConfigured(): void {
  if (!token) {
    throw new Error(
      "Sanity write token is not configured: set SANITY_API_WRITE_TOKEN (or SANITY_API_TOKEN) on the service.",
    );
  }
}
