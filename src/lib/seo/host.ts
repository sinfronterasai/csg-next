// Environment-aware host/canonical/robots helpers (pure, no Next runtime import).
import { SITE_BASE_URL } from "@/lib/seo";

const FALLBACK_PROD_HOSTS = ["cosmicspiritguide.com", "www.cosmicspiritguide.com"];

export function getConfiguredProdHosts(): string[] {
  const env = process.env.NEXT_PUBLIC_PROD_HOST;
  return env ? env.split(",").map((s) => s.trim().toLowerCase()) : FALLBACK_PROD_HOSTS;
}

export function getCanonicalProdHost(): string {
  return (process.env.NEXT_PUBLIC_CANONICAL_HOST || "cosmicspiritguide.com").toLowerCase();
}

function hostnameOf(host: string | null | undefined): string {
  if (!host) return "";
  let h = host;
  if (h.startsWith("http://") || h.startsWith("https://")) {
    try {
      h = new URL(h).hostname;
    } catch (e) {
      h = h.split("/")[2] || h;
    }
  }
  return h.split(":")[0].toLowerCase();
}

export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return getConfiguredProdHosts().indexOf(hostnameOf(host)) !== -1;
}

export function getActiveBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || SITE_BASE_URL).replace(/\/$/, "");
}

export function isPreviewEnv(): boolean {
  return !isProductionHost(getActiveBaseUrl());
}

export function getXRobotsTag(host: string | null | undefined): string | null {
  return isProductionHost(host) ? null : "noindex, nofollow";
}

export function resolveCanonicalUrl(path: string, host: string | null | undefined): string {
  const clean = path.startsWith("/") ? path : "/" + path;
  if (isProductionHost(host)) return "https://" + getCanonicalProdHost() + clean;
  if (host) return "https://" + hostnameOf(host) + clean;
  return getActiveBaseUrl() + clean;
}
