import type { VersionBundle } from './types';

export interface AiEvidenceBlock { id: string; text: string; evidenceIds: string[] }
export interface YearlyTransitAiResponse {
  schemaVersion: 'csg-yearly-transit-ai-v1';
  reportId: string;
  reportType: 'yearlytransit';
  versionBundle: VersionBundle;
  overallTheme: { id: string; text: string; evidenceIds: string[] };
  primaryWindows: Array<{ id: string; title: string; interpretation: string; recommendations: string[]; evidenceIds: string[] }>;
  monthlyContext: Array<{ id: string; monthKey: string; summary: string; evidenceIds: string[] }>;
  actions: Array<{ id: string; text: string; evidenceIds: string[] }>;
  appendixSummary: { id: string; text: string; evidenceIds: string[] };
}

export const AI_TOP_LEVEL_KEYS = ['schemaVersion','reportId','reportType','versionBundle','overallTheme','primaryWindows','monthlyContext','actions','appendixSummary'] as const;
export const AI_PRIMARY_KEYS = ['id','title','interpretation','recommendations','evidenceIds'] as const;
export const AI_MONTHLY_KEYS = ['id','monthKey','summary','evidenceIds'] as const;
export const AI_ACTION_KEYS = ['id','text','evidenceIds'] as const;
export const AI_THEME_KEYS = ['id','text','evidenceIds'] as const;
export const AI_APPENDIX_KEYS = ['id','text','evidenceIds'] as const;

export function exactKeys(value: unknown, keys: readonly string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}
