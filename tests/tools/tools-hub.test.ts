jest.mock('@/lib/blog/queries', () => ({
  fetchAllPostSlugs: jest.fn().mockResolvedValue([]),
}));

import fs from 'node:fs';
import sitemap from '@/app/sitemap';
import toolsPage, { generateMetadata } from '@/app/tools/page';
import { getToolById, getTools, isNamedTransitEnabled } from '@/lib/tools/registry';
import { NAMED_TRANSIT_EXPERIMENT_ID } from '@/lib/namedTransit';

describe('canonical Tools discovery hub', () => {
  const originalFlag = process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
  const originalPublicFlag = process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    else process.env.CSG_NAMED_TRANSIT_EXPERIMENT = originalFlag;
    if (originalPublicFlag === undefined) delete process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT;
    else process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT = originalPublicFlag;
  });

  it('has a real /tools route and page metadata', async () => {
    expect(typeof toolsPage).toBe('function');
    const metadata = await generateMetadata();
    expect(metadata.alternates?.canonical).toBe('https://cosmicspiritguide.com/tools');
    expect(metadata.title).toBe('Tools | Cosmic Spirit Guide');
  });

  it('registers the Personalized Transit Explorer on its existing route', () => {
    const tool = getToolById('personalized-transit-explorer');
    expect(tool).toMatchObject({
      id: 'personalized-transit-explorer',
      name: 'Personalized Transit Explorer',
      href: '/transits',
      cta: expect.any(String),
      featured: true,
    });
    expect(tool?.description).toContain('Saturn square natal Moon');
    expect(tool?.description).toContain('Swiss Ephemeris');
    expect(NAMED_TRANSIT_EXPERIMENT_ID).toBe('R-016-saturn-square-natal-moon');
  });

  it('preserves registry availability behavior for the R-016 flag', () => {
    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    delete process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT;
    expect(isNamedTransitEnabled()).toBe(false);
    expect(getToolById('personalized-transit-explorer')?.availability).toBe('limited-rollout');

    process.env.CSG_NAMED_TRANSIT_EXPERIMENT = 'true';
    expect(isNamedTransitEnabled()).toBe(true);
    expect(getToolById('personalized-transit-explorer')?.availability).toBe('available');

    delete process.env.CSG_NAMED_TRANSIT_EXPERIMENT;
    process.env.NEXT_PUBLIC_NAMED_TRANSIT_EXPERIMENT = 'true';
    expect(getToolById('personalized-transit-explorer')?.availability).toBe('available');
    expect(getTools()).toHaveLength(2);
  });

  it('adds Tools to the primary desktop/mobile navigation architecture', () => {
    const source = fs.readFileSync('src/components/SiteHeader.tsx', 'utf8');
    expect(source).toContain('href="/tools"');
    expect(source).toContain('{navLinks}');
  });

  it('tracks only the canonical discovery events with tool identity on selection', () => {
    const source = fs.readFileSync('src/app/tools/ToolsHub.tsx', 'utf8');
    expect(source).toContain("track('tools_hub_view'");
    expect(source).toContain("track('tool_selected'");
    expect(source).toContain('tool_id: tool.id');
    expect(source).toContain('tool_name: tool.name');
    expect(source).not.toContain('segment');
    expect(source).not.toContain('mixpanel');
  });

  it('adds /tools to the canonical sitemap', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://cosmicspiritguide.com/tools');
  });
});
