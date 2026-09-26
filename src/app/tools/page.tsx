import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, mergeJsonLd, organizationJsonLd, webApplicationJsonLd } from '@/lib/seo/jsonld';
import { SeoJsonLd } from '@/components/seo/SeoJsonLd';
import { getTools } from '@/lib/tools/registry';
import ToolsHub from './ToolsHub';

const TOOLS_PATH = '/tools';
const TOOLS_DESCRIPTION = 'Explore Cosmic Spirit Guide interactive tools, including personalized transit timing and the Cosmic Navigator star map.';

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = buildMetadata({
    title: 'Tools | Cosmic Spirit Guide',
    description: TOOLS_DESCRIPTION,
    path: TOOLS_PATH,
    type: 'website',
    jsonLd: mergeJsonLd(
      organizationJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Tools', path: TOOLS_PATH }]),
      webApplicationJsonLd({ description: TOOLS_DESCRIPTION }),
    ),
  });
  return metadata;
}

export default function ToolsPage() {
  const jsonLd = mergeJsonLd(
    organizationJsonLd(),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Tools', path: TOOLS_PATH }]),
    webApplicationJsonLd({ description: TOOLS_DESCRIPTION }),
  );
  return (
    <>
      <SeoJsonLd data={jsonLd} />
      <ToolsHub tools={getTools()} />
    </>
  );
}
