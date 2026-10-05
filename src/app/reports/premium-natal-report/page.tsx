import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, faqPageJsonLd, mergeJsonLd, organizationJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';
import ReportLandingPage from '@/components/reports/ReportLandingPage';
import { REPORT_LANDING_CONTENT } from '@/lib/reportLandingPages';
import { REPORT_META } from '@/lib/reportEngine';

const content = REPORT_LANDING_CONTENT.natalpremium;
const path = '/reports/premium-natal-report';

export async function generateMetadata(): Promise<Metadata> {
  const faq = faqPageJsonLd(content.faqs);
  const { metadata } = buildMetadata({
    title: `${content.name} | Cosmic Spirit Guide`,
    description: 'Turn your saved birth chart into a deeper written natal interpretation with the Premium Natal Report.',
    path,
    jsonLd: mergeJsonLd(organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Reports', path: '/reports' }, { name: content.name, path }]), faq),
  });
  return metadata;
}

export default function PremiumNatalReportPage() {
  const faq = faqPageJsonLd(content.faqs);
  const jsonLd = mergeJsonLd(organizationJsonLd(), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Reports', path: '/reports' }, { name: content.name, path }]), faq);
  return <><SeoJsonLd data={jsonLd} /><ReportLandingPage content={content} price={REPORT_META.natalpremium.price} /></>;
}
