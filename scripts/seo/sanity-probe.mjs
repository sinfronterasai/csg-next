// Read-only probe of Sanity production, using env token. Never prints token value.
import { createClient } from '@sanity/client';
const projectId = process.env.SANITY_PROJECT_ID || 'kicslgfz';
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;
const client = createClient({ projectId, dataset, apiVersion: '2023-05-03', useCdn: false, token });
try {
  const q = `*[_type == "blogPost" && status == "published" && defined(slug.current)]{ "slug": slug.current, _id, title, publishedAt, canonicalUrl, seoTitle, metaDescription, robots, _updatedAt }`;
  const posts = await client.fetch(q);
  console.log('COUNT', posts.length);
  // Print minimal fields (no token, no body content)
  for (const p of posts) {
    console.log(JSON.stringify({ slug: p.slug, id: p._id?.slice(0,8), title: (p.title||'').slice(0,60), pub: (p.publishedAt||'').slice(0,10), can: !!p.canonicalUrl, seo: !!p.seoTitle, rob: p.robots }));
  }
} catch (e) {
  console.log('ERR', e.message);
}
