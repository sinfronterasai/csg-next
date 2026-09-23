import type { ActiveWindow, ImportanceBand, MovingBody, NatalTarget } from './types';

export const IMPORTANCE_POLICY_VERSION = 'yt-importance-v1.0.0';
const OUTER = new Set<MovingBody>(['jupiter','saturn','uranus','neptune','pluto']);
const PERSONAL = new Set<NatalTarget>(['sun','moon','mercury','venus','mars']);

export interface ScoringContext {
  chartRuler?: NatalTarget;
  houseRulerRelevant?: boolean;
}

export function importanceBand(score: number): ImportanceBand {
  if (score >= 90) return 'defining';
  if (score >= 75) return 'major';
  if (score >= 60) return 'meaningful';
  if (score >= 40) return 'supporting';
  return 'omit';
}

export function scoreWindow(window: ActiveWindow, context: ScoringContext = {}): ActiveWindow {
  const duration = Math.max(0, Date.parse(window.activeWindow.endUtc) - Date.parse(window.activeWindow.startUtc));
  let raw = 0;
  if (OUTER.has(window.mover) && (window.target === 'asc' || window.target === 'mc')) raw += 30;
  if (OUTER.has(window.mover) && PERSONAL.has(window.target)) raw += 25;
  if (['conjunction','opposition','square'].includes(window.aspectType)) raw += 20;
  if (['trine','sextile'].includes(window.aspectType)) raw += 12;
  if (window.exactHits.length >= 2) raw += 15;
  if (window.minimumActiveError < 0.5) raw += 10;
  if (window.mover === 'sun' || window.mover === 'moon' || window.target === 'sun' || window.target === 'moon') raw += 10;
  if (context.chartRuler === window.target) raw += 10;
  if (context.houseRulerRelevant) raw += 8;
  if (OUTER.has(window.mover)) raw += 8;
  const importanceScore = Math.min(raw, 100);
  return { ...window, duration, rawImportanceScore: raw, importanceScore, importanceBand: importanceBand(importanceScore), evidenceIds: window.evidenceIds };
}

export function compareImportance(a: ActiveWindow, b: ActiveWindow): number {
  return b.importanceScore - a.importanceScore || b.rawImportanceScore - a.rawImportanceScore ||
    (b.duration ?? Date.parse(b.activeWindow.endUtc) - Date.parse(b.activeWindow.startUtc)) - (a.duration ?? Date.parse(a.activeWindow.endUtc) - Date.parse(a.activeWindow.startUtc)) ||
    b.exactHits.length - a.exactHits.length || a.activeWindow.startUtc.localeCompare(b.activeWindow.startUtc) || a.canonicalTransitId.localeCompare(b.canonicalTransitId);
}

export function rankWindows(windows: readonly ActiveWindow[]): ActiveWindow[] {
  return [...windows].sort(compareImportance);
}
