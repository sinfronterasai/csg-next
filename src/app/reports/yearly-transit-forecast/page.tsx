import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, faqPageJsonLd, mergeJsonLd, organizationJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';
import ReportLandingPage from '@/components/reports/ReportLandingPage';
import { REPORT_LANDING_CONTENT } from '@/lib/reportLandingPages';
import { REPORT_META } from '@/lib/reportEngine';

const content = REPORT_LANDING_CONTENT.transit;
const path = '/reports/yearly-transit-forecast';

export async function generateMetadata(): Promise<Metadata> {
  const faq = faqPageJsonLd(content.faqs);
  const { metadata } = buildMetadata({
    title: `${content.name} | Cosmic Spirit Guide`,
    description: 'Use your saved birth chart to explore the next twelve months of transit themes and timing.',
    path,
    jsonLd: mergeJsonLd(organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Reports', path: '/reports' }, { name: content.name, path }]), faq),
  });
  return metadata;
}

export default function YearlyTransitForecastPage() {
  const faq = faqPageJsonLd(content.faqs);
  const jsonLd = mergeJsonLd(organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Reports', path: '/reports' }, { name: content.name, path }]), faq);
  return <><SeoJsonLd data={jsonLd} /><ReportLandingPage content={content} price={REPORT_META.transit.price} /></>;
}
