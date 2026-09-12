import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SeoJsonLd } from "@/components/seo/SeoJsonLd";
import { organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { fetchPublishedPosts } from "@/lib/blog/queries";

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
  let posts: Array<{ slug: string; title: string; excerpt?: string; publishedAt?: string }> = [];
  try {
    const raw = await fetchPublishedPosts();
    posts = (raw || []).map((p: any) => ({
      slug: p.slug?.current ?? p.slug,
      title: p.title,
      excerpt: p.excerpt,
      publishedAt: p.publishedAt,
    }));
  } catch (err) {
    console.error("[blog] index fetch failed:", err);
  }

  const jsonLd = [
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]),
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/">Home</Link> / <span>Blog</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold">Blog</h1>
      {posts.length === 0 ? (
        <p className="mt-4 text-lg text-muted-foreground">
          New writing is on the way. Articles are published here as they complete editorial review.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link className="text-xl font-medium underline" href={"/blog/" + p.slug}>
                {p.title}
              </Link>
              {p.excerpt ? <p className="mt-1 text-muted-foreground">{p.excerpt}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
