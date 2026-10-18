import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { organizationJsonLd, breadcrumbJsonLd, mergeJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: 'Quizzes | Cosmic Spirit Guide',
    description: 'Reflective quizzes from Cosmic Spirit Guide, starting with the Tarot Archetype quiz.',
    path: '/quizzes',
    type: 'website',
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Quizzes', path: '/quizzes' }]),
    ),
  });
  return metadata;
}

export default function QuizzesPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Quizzes', path: '/quizzes' }]),
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-cosmic-100">
      <SeoJsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-cosmic-300">
        <Link href="/">Home</Link> / <span>Quizzes</span>
      </nav>
      <h1 className="mt-4 font-serif text-4xl text-gold">Quizzes</h1>
      <p className="mt-4 text-lg text-cosmic-200">Short, reflective tools for exploring the themes you are already carrying.</p>
      <Link href="/quizzes/tarot-archetype" className="mt-8 block rounded-2xl border border-gold/30 bg-cosmic-900/50 p-6 hover:border-gold/70">
        <h2 className="font-serif text-2xl text-white">What&rsquo;s Your Tarot Archetype?</h2>
        <p className="mt-2 text-sm text-cosmic-200">Answer six questions and receive a shareable archetype result. Free, no signup required.</p>
        <span className="mt-4 inline-block text-sm font-semibold text-gold">Take the quiz →</span>
      </Link>
    </main>
  );
}
