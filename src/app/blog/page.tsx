import Link from "next/link";
import type { Metadata } from "next";
import { fetchPublishedPosts } from "@/lib/blog/queries";
import { transformList, type BlogPostListItem } from "@/lib/blog/transform";
import { SITE_BASE_URL } from "@/lib/seo";
import { buildBreadcrumbList } from "@/lib/blog/breadcrumb";

export const metadata: Metadata = {
  title: "Cosmic Spirit Guide Blog | Astrology, Rituals & Manifestation",
  description:
    "Guides on astrology, birth charts, lunar rituals, and cosmic manifestation from the Cosmic Spirit Guide editorial team.",
  alternates: { canonical: `${SITE_BASE_URL}/blog` },
  robots: { index: true, follow: true },
};

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default async function BlogIndexPage() {
  let posts: BlogPostListItem[] = [];
  try {
    const raw = await fetchPublishedPosts();
    posts = (raw ? transformList(raw) : []).filter((p: any) => p.slug);
  } catch (err) {
    console.error("[blog] failed to load posts:", err);
  }

  const breadcrumbJson = buildBreadcrumbList([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJson }}
      />
      <header className="mb-10 text-center">
        <p className="text-sm uppercase tracking-widest text-cosmic-300">
          The Journal
        </p>
        <h1 className="glow-text-gold font-serif pt-2 text-4xl font-bold text-gold">
          Cosmic Spirit Guide Blog
        </h1>
        <p className="mt-3 text-cosmic-300">
          Guides on astrology, birth charts, lunar rituals, and cosmic
          manifestation.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-center text-cosmic-300">
          Our first articles are on their way. Check back soon.
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p: any) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group block overflow-hidden rounded-2xl border border-gold/15 bg-cosmic-900/40 transition hover:border-gold/40"
            >
              {p.featuredImage?.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.featuredImage.url}
                  alt={p.featuredImage.alt}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-cosmic-800 to-cosmic-900 text-cosmic-500">
                  Cosmic Spirit Guide
                </div>
              )}
              <div className="p-5">
                {p.category ? (
                  <p className="text-xs uppercase tracking-widest text-gold/70">
                    {p.category}
                  </p>
                ) : null}
                <h2 className="mt-2 font-serif text-xl font-semibold text-gold group-hover:underline">
                  {p.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-cosmic-400">
                  {p.publishedAt ? <span>{formatDate(p.publishedAt)}</span> : null}
                  {p.readingTime ? <span>· {p.readingTime} min read</span> : null}
                </div>
                {p.excerpt ? (
                  <p className="mt-3 line-clamp-3 text-sm text-cosmic-300">
                    {p.excerpt}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
