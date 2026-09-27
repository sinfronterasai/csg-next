export type ToolAvailability = 'available' | 'limited-rollout';

export type ToolId = 'personalized-transit-explorer' | 'cosmic-navigator';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  href: string;
  cta: string;
  availability: ToolAvailability;
  featured?: boolean;
}

export function getTools(): ToolDefinition[] {
  return [
    {
      id: 'personalized-transit-explorer',
      name: 'Personalized Transit Explorer',
      description: 'Find exact Saturn square natal Moon windows from your known birth details, with deterministic Swiss Ephemeris timing and UTC-backed active windows.',
      href: '/transits',
      cta: 'Explore your transit window',
      availability: 'available',
      featured: true,
    },
    {
      id: 'cosmic-navigator',
      name: 'Cosmic Navigator',
      description: 'Explore an interactive celestial map and see the named stars and astronomical markers around you.',
      href: '/constellations',
      cta: 'Open Cosmic Navigator',
      availability: 'available',
    },
  ];
}

export function getToolById(id: string): ToolDefinition | undefined {
  return getTools().find((tool) => tool.id === id);
}
