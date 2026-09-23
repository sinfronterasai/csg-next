import type { VersionBundle } from './types';

// Each value is changed only when the owning algorithm/contract/template changes.
export const YEARLY_TRANSIT_VERSIONS: VersionBundle = {
  transitEngineVersion: 'yt-engine-v1.0.0',
  importancePolicyVersion: 'yt-importance-v1.0.0',
  eclipsePolicyVersion: 'yt-eclipse-swiss-v1.0.0',
  factPackVersion: 'yt-fact-pack-v1.0.0',
  aiContractVersion: 'yt-ai-contract-v1.1.0',
  reportTemplateVersion: 'yt-template-v1.1.0',
};

export const YEARLY_TRANSIT_SCAN_GRID_HOURS = {
  fast: 6,
  slow: 24,
} as const;
export const YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES = 1;
export const YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS = 60;
export const YEARLY_TRANSIT_EXACT_HIT_DEG = 0.1;
export const ECLIPSE_PROXIMITY_DEG = 3;

export function assertVersionBundle(bundle: VersionBundle): void {
  const keys: (keyof VersionBundle)[] = [
    'transitEngineVersion', 'importancePolicyVersion', 'eclipsePolicyVersion',
    'factPackVersion', 'aiContractVersion', 'reportTemplateVersion',
  ];
  for (const key of keys) {
    if (typeof bundle[key] !== 'string' || bundle[key].trim() === '') {
      throw new Error(`missing yearly-transit version: ${key}`);
    }
  }
}
