import Link from "next/link";
import type { Metadata } from "next";
import { fetchLatestPost } from "@/lib/blog/queries";
import { transformPost } from "@/lib/blog/transform";
import PortableText from "@/components/blog/PortableText";
import { SITE_BASE_URL } from "@/lib/seo";

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
  let post = null;
  try {
    const raw = await fetchLatestPost();
    if (raw) post = transformPost(raw, SITE_BASE_URL);
  } catch (err) {
    console.error("[blog] failed to load latest post:", err);
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="glow-text-gold font-serif pt-2 text-4xl font-bold text-gold">
          Cosmic Spirit Guide Blog
        </h1>
        <p className="mt-4 text-cosmic-300">Our first article is on its way. Check back soon.</p>
      </main>
    );
  }

  const imageFallback = `${post.title} — Cosmic Spirit Guide`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 text-center">
        <p className="text-sm uppercase tracking-widest text-cosmic-300">The Journal</p>
        <h1 className="glow-text-gold font-serif pt-2 text-4xl font-bold text-gold">
          Cosmic Spirit Guide Blog
        </h1>
      </header>

      <article>
        <header className="mb-8">
          {post.category ? (
            <p className="text-xs uppercase tracking-widest text-gold/70">{post.category}</p>
          ) : null}
          <h2 className="glow-text-gold font-serif pt-2 text-4xl font-bold text-gold">
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-cosmic-400">
            <span>{post.author}</span>
            {post.publishedAt ? <span>· {formatDate(post.publishedAt)}</span> : null}
            {post.readingTime ? <span>· {post.readingTime} min read</span> : null}
          </div>
        </header>

        {post.featuredImage.url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.featuredImage.url}
            alt={post.featuredImage.alt}
            className="mb-10 w-full rounded-2xl border border-gold/20"
          />
        ) : null}

        {post.excerpt ? (
          <p className="mb-8 text-xl text-cosmic-100">{post.excerpt}</p>
        ) : null}

        <PortableText value={post.content} imageFallback={imageFallback} />

        {post.faqSection.length > 0 ? (
          <section className="mt-12 rounded-2xl border border-gold/20 bg-cosmic-900/40 p-6">
            <h2 className="font-serif mb-4 text-2xl font-semibold text-gold">Frequently Asked</h2>
            <div className="space-y-4">
              {post.faqSection.map((f, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-cosmic-100">{f.question}</h3>
                  <p className="mt-1 text-cosmic-300">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-12 border-t border-white/10 pt-6 text-center">
          <Link href={`/blog/${post.slug}`} className="text-gold underline-offset-4 hover:underline">
            Read the full article →
          </Link>
        </div>
      </article>
    </main>
  );
}
