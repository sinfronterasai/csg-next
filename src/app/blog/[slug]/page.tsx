import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchPostBySlug, fetchAllPostSlugs } from "@/lib/blog/queries";
import { transformPost } from "@/lib/blog/transform";
import PortableText from "@/components/blog/PortableText";
import { SITE_BASE_URL } from "@/lib/seo";
import { buildBreadcrumbList, escapeJsonLd } from "@/lib/blog/breadcrumb";

export async function generateStaticParams() {
  // Pre-build every published article so each is reachable by its slug.
  try {
    const slugs = await fetchAllPostSlugs();
    return (slugs || []).map((slug: string) => ({ slug }));
  } catch {
    // ignore - pages will render on demand
  }
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let post = null;
  try {
    const raw = await fetchPostBySlug(slug);
    if (raw) post = transformPost(raw, SITE_BASE_URL);
  } catch (err) {
    console.error("[blog] metadata fetch failed:", err);
  }
  if (!post) return { title: "Article Not Found | Cosmic Spirit Guide" };

  const s = post.seo;
  return {
    title: s.seoTitle,
    description: s.metaDescription,
    alternates: { canonical: s.canonicalUrl ?? `${SITE_BASE_URL}/blog/${post.slug}` },
    robots: {
      index: s.robots.includes("noindex") ? false : true,
      follow: s.robots.includes("nofollow") ? false : true,
    },
    openGraph: {
      type: "article",
      title: s.ogTitle,
      description: s.ogDescription,
      url: s.ogUrl ?? `${SITE_BASE_URL}/blog/${post.slug}`,
      siteName: s.ogSiteName,
      images: s.ogImage ? [{ url: s.ogImage }] : undefined,
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: s.twitterCard as any,
      title: s.twitterTitle,
      description: s.twitterDescription,
      images: s.twitterImage ? [s.twitterImage] : undefined,
      site: s.twitterSite ?? undefined,
    },
  };
}

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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let raw = null;
  try {
    raw = await fetchPostBySlug(slug);
  } catch (err) {
    console.error("[blog] post fetch failed:", err);
  }
  if (!raw) notFound();
  const post = transformPost(raw, SITE_BASE_URL);

  const imageFallback = `${post.title} — Cosmic Spirit Guide`;
  const jsonLd = post.seo.schemaJson
    ? post.seo.schemaJson
    : JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.seo.metaDescription,
        author: { "@type": "Person", name: post.author },
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        image: post.featuredImage.url ?? undefined,
        publisher: { "@type": "Organization", name: "Cosmic Spirit Guide" },
        mainEntityOfPage: `${SITE_BASE_URL}/blog/${post.slug}`,
      });

  // Merge Master-generated FAQPage schema (faqSchema) if present, so the
  // structured data matches what the pipeline produced instead of rebuilding it.
  const jsonLdBlocks: string[] = [jsonLd];
  if (post.seo.faqSchema) {
    // CMS-provided JSON; escape before injecting via dangerouslySetInnerHTML
    // so a title/answer containing "</script>" cannot break out of the block.
    jsonLdBlocks.push(escapeJsonLd(post.seo.faqSchema));
  }
  const breadcrumbJson = buildBreadcrumbList([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);
  jsonLdBlocks.push(escapeJsonLd(breadcrumbJson));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: block }}
        />
      ))}

      <article>
        <header className="mb-8">
          {post.category ? (
            <p className="text-xs uppercase tracking-widest text-gold/70">{post.category}</p>
          ) : null}
          <h1 className="glow-text-gold font-serif pt-2 text-4xl font-bold text-gold">
            {post.title}
          </h1>
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

        {post.geo.summary ? (
          <section className="mt-10 text-sm text-cosmic-400">
            <h2 className="font-serif mb-2 text-lg text-gold/80">About this topic</h2>
            <p>{post.geo.summary}</p>
          </section>
        ) : null}
      </article>

      {post.relatedReading && post.relatedReading.length > 0 ? (
        <section className="mt-12 rounded-2xl border border-gold/20 bg-cosmic-900/40 p-6">
          <h2 className="font-serif mb-4 text-2xl font-semibold text-gold">Related Reading</h2>
          <ul className="space-y-2">
            {post.relatedReading.map((r, i) => (
              <li key={i}>
                <Link href={`/blog/${r.slug}`} className="text-gold underline-offset-4 hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-12 border-t border-white/10 pt-6 text-center">
        <Link href="/blog" className="text-gold underline-offset-4 hover:underline">
          ← Back to all articles
        </Link>
      </div>
    </main>
  );
}
