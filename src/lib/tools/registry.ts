export type ToolAvailability = 'available' | 'limited-rollout';

export type ToolId = 'next-major-transit' | 'cosmic-navigator' | 'moon-sign-phase-calculator';

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
      id: 'next-major-transit',
      name: 'Your Next Major Transit',
      description: 'Discover the next major planetary transit to your birth chart and when it is strongest.',
      href: '/transits',
      cta: 'Find My Next Transit',
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
    {
      id: 'moon-sign-phase-calculator',
      name: 'Moon Sign & Phase Calculator',
      description: 'Calculate your natal Moon sign from your birth date, time, and location using Swiss Ephemeris, and see the current lunar phase and illumination.',
      href: '/moon-calculator',
      cta: 'Calculate Your Moon Sign',
      availability: 'available',
    },
  ];
}

export function getToolById(id: string): ToolDefinition | undefined {
  // Keep direct links from the retired identity resolvable without exposing it in the canonical hub.
  if (id === 'personalized-transit-explorer') {
    const current = getTools()[0];
    return { ...current, id: 'personalized-transit-explorer' as ToolId, name: 'Personalized Transit Explorer', description: 'Legacy link for the former Saturn square natal Moon explorer; Swiss Ephemeris remains the deterministic source. Use Your Next Major Transit for the current discovery contract.' };
  }
  return getTools().find((tool) => tool.id === id);
}
