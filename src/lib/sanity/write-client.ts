/**
 * Write-capable Sanity client for the content pipeline.
 *
 * `src/lib/sanity/client.ts` is read-only (published perspective, CDN on) and
 * must stay that way — it backs every public page. Writing needs its own
 * client: a write token, the CDN bypassed, and the default raw perspective so
 * drafts stay visible to editors.
 */

import { createClient, type SanityClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID || "kicslgfz";
const dataset = process.env.SANITY_DATASET || "production";

/**
 * Uses a dedicated write token when present, then falls back to the existing
 * project token so ops only has to provision one variable if it already has
 * write scope.
 */
export function getSanityWriteToken(): string | null {
  const token = process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_TOKEN || "";
  const trimmed = token.trim();
  return trimmed.length ? trimmed : null;
}

export function getSanityWriteClient(): SanityClient | null {
  const token = getSanityWriteToken();
  if (!token) return null;

  return createClient({
    projectId,
    dataset,
    apiVersion: "2023-05-03",
    token,
    useCdn: false,
  });
}

export const SANITY_WRITE_PROJECT_ID = projectId;
export const SANITY_WRITE_DATASET = dataset;
