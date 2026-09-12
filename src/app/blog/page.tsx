import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { fetchPublishedPosts } from "@/lib/blog/queries";
import { transformPost } from "@/lib/blog/transform";
import { SITE_BASE_URL } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: "Blog | Cosmic Spirit Guide",
    description:
      "Reflections on astrology, tarot, and the cosmos from Cosmic Spirit Guide. New writing is published as it is reviewed and approved.",
    path: "/blog",
    type: "website",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]),
    ],
  });
  return metadata;
}

export default async function BlogIndex() {
  let posts: ReturnType<typeof transformPost>[] = [];
  try {
    const raw = await fetchPublishedPosts();
    posts = (raw || []).map((p: any) => transformPost(p, SITE_BASE_URL));
  } catch (err) {
    console.error("[blog] index fetch failed:", err);
  }

  const featuredPosts = posts.slice(0, 9);
  const hasMore = posts.length > featuredPosts.length;

  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]),
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Blog</span>
      </nav>
      <header className="mt-4 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold/75">Cosmic journal</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-gold sm:text-5xl">Stories for the sky you live under</h1>
        <p className="mt-4 text-lg leading-8 text-cosmic-200/80">
          Reflections on astrology, tarot, timing, and the choices that make a reading useful.
        </p>
      </header>
      {featuredPosts.length === 0 ? (
        <p className="mt-10 text-lg text-muted-foreground">
          New writing is on the way. Articles are published here as they complete editorial review.
        </p>
      ) : (
        <>
          <section aria-label="Featured articles" className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredPosts.map((post) => (
              <article key={post.slug} className="group overflow-hidden rounded-2xl border border-gold/20 bg-cosmic-900/65 shadow-lg shadow-black/20 transition hover:-translate-y-1 hover:border-gold/50">
                <Link href={`/blog/${post.slug}`} className="block">
                  {post.featuredImage.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={post.featuredImage.url} alt={post.featuredImage.alt} className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-cosmic-primary/80 via-cosmic-secondary/70 to-cosmic-950 font-serif text-2xl text-gold">✦</div>
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-gold/70">
                      {post.category ? <span>{post.category}</span> : null}
                      {post.publishedAt ? <span>· {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> : null}
                    </div>
                    <h2 className="mt-3 font-serif text-2xl font-semibold leading-tight text-cosmic-50 group-hover:text-gold">{post.title}</h2>
                    {post.excerpt ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-cosmic-200/75">{post.excerpt}</p> : null}
                    <span className="mt-5 inline-flex text-sm font-semibold text-gold">Read article <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1">→</span></span>
                  </div>
                </Link>
              </article>
            ))}
          </section>
          {hasMore ? (
            <div className="mt-12 text-center">
              <Link href="/blog/archive" className="inline-flex rounded-full border border-gold/50 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-gold transition hover:bg-gold/10">More articles</Link>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
