import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from "@/lib/seo/jsonld";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { isProgrammaticIndexed } from "@/lib/seo/programmatic-approval";
import { computeTransitBodies, dateToJulianDay, ASPECT_DEFS } from "@/lib/transit";

export const dynamicParams = true;

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const title = "Transits for " + date + " | Cosmic Spirit Guide";
  const description =
    "Dated transit positions from Swiss Ephemeris, with clear date semantics and no unsupported active-window claims.";
  const { metadata } = buildMetadata({
    title,
    description,
    path: "/transits/" + date,
    type: "website",
    noindex: !isProgrammaticIndexed("transits", date, date),
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Transits", path: "/transits" },
        { name: date, path: "/transits/" + date },
      ])
    ),
  });
  return metadata;
}

export default async function TransitDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const bodies = await computeTransitBodies(dateToJulianDay(new Date(`${date}T00:00:00Z`)));
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Transits", path: "/transits" },
      { name: date, path: "/transits/" + date },
    ])
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <Link href="/transits">Transits</Link> / <span>{date}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Transits for {date}</h1>
      <p className="mt-3 text-lg">
        A transit is a planet's current position measured against the backdrop of the zodiac. When a
        planet moves through a sign or touches a point in your chart, it colors the themes of that
        area for a window of time.
      </p>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Sky positions for {date}</h2>
        <p className="mt-2 text-sm text-muted-foreground">This is the requested UTC calendar date. It is not an active window or a duration claim; an active window requires a natal chart and repeated-date analysis.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2 pr-4">Body</th><th className="py-2 pr-4">Position</th><th className="py-2">Motion</th></tr></thead>
            <tbody>{bodies.map((body) => <tr key={body.key} className="border-b last:border-0"><td className="py-2 pr-4">{body.glyph} {body.label}</td><td className="py-2 pr-4">{body.signLabel} {body.degreeInSign.toFixed(2)}°</td><td className="py-2">{body.retrograde ? 'Retrograde' : 'Direct'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-xl font-medium">Method</h2>
        <p className="mt-2 text-sm">Tropical positions use Swiss Ephemeris at 00:00 UTC for the requested date. The transit set includes the Sun through Pluto. When a natal chart is supplied, major aspects are conjunction ({ASPECT_DEFS[0].orb}°), sextile ({ASPECT_DEFS[1].orb}°), square ({ASPECT_DEFS[2].orb}°), trine ({ASPECT_DEFS[3].orb}°), and opposition ({ASPECT_DEFS[4].orb}°); retrograde status comes from ephemeris speed. This page does not claim a personalized active window without natal birth data.</p>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">
        Build your <Link className="underline" href="/birth-chart">free birth chart</Link> to see how transits land on your own planets, then explore the <Link className="underline" href="/reports">contextual reports</Link>.
      </p>
    </main>
  );
}
