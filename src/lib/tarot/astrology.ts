import { query } from "@/lib/db";
import { getSign } from "@/lib/astrology";

type AnyChart = {
  planets?: any;
  ascendant?: string | { sign?: string; signLabel?: string };
  midheaven?: string | { sign?: string };
};

function signLabel(sign: unknown): string | null {
  if (!sign) return null;
  if (typeof sign === "string") {
    const info = getSign(sign);
    return info ? info.label : sign.charAt(0).toUpperCase() + sign.slice(1);
  }
  if (typeof sign === "object") {
    const s = (sign as any).signLabel || (sign as any).sign;
    return signLabel(s);
  }
  return null;
}

function planetSign(chart: AnyChart, key: string): string | null {
  const planets = chart.planets;
  if (!planets) return null;
  // Object form: planets.sun = { sign }
  if (!Array.isArray(planets)) {
    const p = planets[key.toLowerCase()];
    return signLabel(p?.sign);
  }
  // Array form: planets = [{ key, signLabel }]
  const p = planets.find((x) => (x.key || "").toLowerCase() === key);
  return signLabel(p?.signLabel || p?.sign);
}

/** Summarize a natal chart into a short string for blending into a tarot reading. */
export function summarizeChart(chart: AnyChart | null | undefined): string {
  if (!chart) return "";
  const parts: string[] = [];
  const sun = planetSign(chart, "sun");
  const moon = planetSign(chart, "moon");
  if (sun) parts.push(`Sun in ${sun}`);
  if (moon) parts.push(`Moon in ${moon}`);
  const asc = signLabel(chart.ascendant);
  if (asc) parts.push(`Ascendant in ${asc}`);
  return parts.join(", ");
}

export interface AstrologyOverlay {
  summary: string;
  transits?: string;
}

/** Resolve a user's primary birth chart into an astrology overlay for tarot. */
export async function getAstrologyOverlay(userId: number | string): Promise<AstrologyOverlay | null> {
  try {
    const { rows } = await query(
      `SELECT chart_data FROM birth_charts WHERE user_id = $1 AND is_primary = true ORDER BY created_at DESC LIMIT 1`,
      [Number(userId)],
    );
    const summary = summarizeChart(rows[0]?.chart_data ?? null);
    if (!summary) return null;
    return { summary };
  } catch {
    return null;
  }
}
