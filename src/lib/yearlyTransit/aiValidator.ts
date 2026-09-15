import type { YearlyTransitFactPack, VersionBundle } from './types';
import { exactKeys, AI_ACTION_KEYS, AI_APPENDIX_KEYS, AI_MONTHLY_KEYS, AI_PRIMARY_KEYS, AI_THEME_KEYS, AI_TOP_LEVEL_KEYS, type YearlyTransitAiResponse } from './aiSchema';

const MAX_BLOCK_CHARS = 2_000;
const MAX_ACTION_CHARS = 600;
const MAX_TOTAL_CHARS = 12_000;
const CERTAINTY = /\b(?:you will|you are going to|this will cause|it will happen|guaranteed to)\b/i;
const INTERNAL = /importanceScore|rawImportanceScore|\bYt Window\b|\b(?:activeWindow|evidenceIds|schemaVersion|aspectType)\b/i;
const RAW_ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;

function fail(message: string): never { throw new Error(`invalid yearly-transit AI response: ${message}`); }
function text(value: unknown, limit: number, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be non-empty text`);
  if (value.length > limit) fail(`${label} exceeds ${limit} characters`);
  if (CERTAINTY.test(value)) fail(`${label} contains literal-event certainty`);
  if (INTERNAL.test(value)) fail(`${label} contains internal implementation language`);
  if (RAW_ISO.test(value)) fail(`${label} contains raw ISO timestamp`);
  return value;
}
function evidence(value: unknown, allowed: Set<string>, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !allowed.has(id))) fail(`${label} has invalid evidence IDs`);
  if (new Set(value).size !== value.length) fail(`${label} has duplicate evidence IDs`);
  return value as string[];
}
function id(value: unknown, seen: Set<string>, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || seen.has(value)) fail(`${label} has duplicate or invalid ID`);
  seen.add(value); return value;
}
function versionsEqual(actual: VersionBundle, expected: VersionBundle): boolean {
  return Object.keys(expected).every((key) => actual[key as keyof VersionBundle] === expected[key as keyof VersionBundle]) && Object.keys(actual).length === Object.keys(expected).length;
}

export function validateYearlyTransitAiResponse(value: unknown, pack: YearlyTransitFactPack, reportId: string): YearlyTransitAiResponse {
  if (!exactKeys(value, AI_TOP_LEVEL_KEYS)) fail('top-level keys');
  const response = value as Record<string, unknown>;
  if (response.schemaVersion !== 'csg-yearly-transit-ai-v1' || response.reportId !== reportId || response.reportType !== 'yearlytransit') fail('schema or correlation');
  if (!exactKeys(response.versionBundle, Object.keys(pack.versionBundle)) || !versionsEqual(response.versionBundle as VersionBundle, pack.versionBundle)) fail('version bundle');
  const allowed = new Set(Object.keys(pack.facts)); const seen = new Set<string>(); let total = 0;
  const theme = response.overallTheme as Record<string, unknown>;
  if (!exactKeys(theme, AI_THEME_KEYS)) fail('overallTheme keys');
  const overallTheme = { id: id(theme.id, seen, 'overallTheme'), text: text(theme.text, MAX_BLOCK_CHARS, 'overallTheme.text'), evidenceIds: evidence(theme.evidenceIds, allowed, 'overallTheme') }; total += overallTheme.text.length;
  if (!Array.isArray(response.primaryWindows) || response.primaryWindows.length > 8) fail('primaryWindows count');
  const primaryWindows = (response.primaryWindows as unknown[]).map((raw, index) => {
    if (!exactKeys(raw, AI_PRIMARY_KEYS)) fail(`primaryWindows[${index}] keys`); const item = raw as Record<string, unknown>;
    if (!Array.isArray(item.recommendations) || item.recommendations.length > 5) fail(`primaryWindows[${index}] recommendations`);
    const result = { id: id(item.id, seen, `primaryWindows[${index}]`), title: text(item.title, MAX_BLOCK_CHARS, `primaryWindows[${index}].title`), interpretation: text(item.interpretation, MAX_BLOCK_CHARS, `primaryWindows[${index}].interpretation`), recommendations: (item.recommendations as unknown[]).map((r, rIndex) => text(r, MAX_ACTION_CHARS, `primaryWindows[${index}].recommendations[${rIndex}]`)), evidenceIds: evidence(item.evidenceIds, allowed, `primaryWindows[${index}]`) };
    total += result.title.length + result.interpretation.length + result.recommendations.reduce((sum, r) => sum + r.length, 0); return result;
  });
  if (!Array.isArray(response.monthlyContext) || response.monthlyContext.length > 12) fail('monthlyContext count');
  const monthlyContext = (response.monthlyContext as unknown[]).map((raw, index) => { if (!exactKeys(raw, AI_MONTHLY_KEYS)) fail(`monthlyContext[${index}] keys`); const item = raw as Record<string, unknown>; const result = { id: id(item.id, seen, `monthlyContext[${index}]`), monthKey: text(item.monthKey, 32, `monthlyContext[${index}].monthKey`), summary: text(item.summary, MAX_BLOCK_CHARS, `monthlyContext[${index}].summary`), evidenceIds: evidence(item.evidenceIds, allowed, `monthlyContext[${index}]`) }; total += result.summary.length; return result; });
  if (!Array.isArray(response.actions) || response.actions.length > 5) fail('actions count');
  const actions = (response.actions as unknown[]).map((raw, index) => { if (!exactKeys(raw, AI_ACTION_KEYS)) fail(`actions[${index}] keys`); const item = raw as Record<string, unknown>; const result = { id: id(item.id, seen, `actions[${index}]`), text: text(item.text, MAX_ACTION_CHARS, `actions[${index}].text`), evidenceIds: evidence(item.evidenceIds, allowed, `actions[${index}]`) }; total += result.text.length; return result; });
  const appendix = response.appendixSummary as Record<string, unknown>;
  if (!exactKeys(appendix, AI_APPENDIX_KEYS)) fail('appendixSummary keys');
  const appendixSummary = { id: id(appendix.id, seen, 'appendixSummary'), text: text(appendix.text, MAX_BLOCK_CHARS, 'appendixSummary.text'), evidenceIds: evidence(appendix.evidenceIds, allowed, 'appendixSummary') }; total += appendixSummary.text.length;
  if (total > MAX_TOTAL_CHARS) fail(`total text exceeds ${MAX_TOTAL_CHARS} characters`);
  return { schemaVersion: 'csg-yearly-transit-ai-v1', reportId, reportType: 'yearlytransit', versionBundle: response.versionBundle as VersionBundle, overallTheme, primaryWindows, monthlyContext, actions, appendixSummary };
}

export function aiResponseToPipelineSections(response: YearlyTransitAiResponse): Array<{ id: string; prose: string; blocks: Array<{ role: 'meaning' | 'synthesis' | 'agency'; prose: string; factIds: string[] }> }> {
  const sections: Array<{ id: string; prose: string; blocks: Array<{ role: 'meaning' | 'synthesis' | 'agency'; prose: string; factIds: string[] }> }> = [];
  sections.push({ id: response.overallTheme.id, prose: response.overallTheme.text, blocks: [{ role: 'synthesis', prose: response.overallTheme.text, factIds: response.overallTheme.evidenceIds }] });
  for (const item of response.primaryWindows) {
    const blocks = [{ role: 'meaning' as const, prose: `${item.title}\n\n${item.interpretation}`, factIds: item.evidenceIds }, ...item.recommendations.map((prose) => ({ role: 'agency' as const, prose, factIds: item.evidenceIds }))];
    sections.push({ id: item.id, prose: blocks.map((block) => block.prose).join('\n\n'), blocks });
  }
  for (const item of response.monthlyContext) sections.push({ id: item.id, prose: item.summary, blocks: [{ role: 'synthesis', prose: item.summary, factIds: item.evidenceIds }] });
  if (response.actions.length > 0) sections.push({ id: 'actions', prose: response.actions.map((item) => item.text).join('\n\n'), blocks: response.actions.map((item) => ({ role: 'agency' as const, prose: item.text, factIds: item.evidenceIds })) });
  sections.push({ id: response.appendixSummary.id, prose: response.appendixSummary.text, blocks: [{ role: 'synthesis', prose: response.appendixSummary.text, factIds: response.appendixSummary.evidenceIds }] });
  return sections;
}
