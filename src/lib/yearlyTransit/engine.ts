import type { ActiveWindow, AspectType, MovingBody, NatalTarget, TransitDirection } from './types';
import { ACTIVE_ORBS, DEFAULT_MOVING_BODIES, DEFAULT_NATAL_TARGETS } from './policy';
import { YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS, YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES } from './versions';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const FAST_BODIES = new Set<MovingBody>(['sun','moon','mercury','venus','mars']);

export interface EnginePoint {
  longitude: number;
  retrograde: boolean;
  house?: number | null;
}
export interface TransitEvaluator {
  evaluate(body: MovingBody, utcMs: number): Promise<EnginePoint>;
}
export interface NatalAnchor {
  key: NatalTarget;
  longitude: number;
  house: number | null;
}
export interface ScanInput {
  fromUtc: string;
  toUtc: string;
  evaluator: TransitEvaluator;
  natal: readonly NatalAnchor[];
  movingBodies?: readonly MovingBody[];
  natalTargets?: readonly NatalTarget[];
}
interface Sample { utcMs: number; point: EnginePoint; error: number; }

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`non-finite ${label}`);
  return value;
}
function norm(value: number): number { return ((value % 360) + 360) % 360; }
function distance(a: number, b: number): number {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
}
export function aspectError(movingLongitude: number, natalLongitude: number, aspect: AspectType): number {
  const centers: Record<AspectType, number> = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
  const d = distance(movingLongitude, natalLongitude);
  return Math.min(Math.abs(d - centers[aspect]), Math.abs(d - (360 - centers[aspect])));
}
function canonicalInstant(ms: number): string { return new Date(Math.round(ms / 1000) * 1000).toISOString(); }
function directionFrom(samples: Sample[]): TransitDirection {
  if (samples.length < 2) return 'indeterminate';
  const left = samples[0]; const right = samples[samples.length - 1];
  const slope = (right.error - left.error) / ((right.utcMs - left.utcMs) / MINUTE_MS);
  const min = Math.min(...samples.map((s) => s.error));
  const max = Math.max(...samples.map((s) => s.error));
  if (!Number.isFinite(slope) || Math.abs(slope) < 0.000001 || (min < left.error && min < right.error)) return 'stationary';
  return slope < 0 ? 'applying' : 'separating';
}
async function sample(input: ScanInput, body: MovingBody, target: NatalAnchor, aspect: AspectType, utcMs: number): Promise<Sample> {
  const point = await input.evaluator.evaluate(body, utcMs);
  finite(point.longitude, `${body} longitude`);
  const error = finite(aspectError(point.longitude, target.longitude, aspect), 'aspect error');
  return { utcMs, point, error };
}
async function refineBoundary(input: ScanInput, body: MovingBody, target: NatalAnchor, aspect: AspectType, left: Sample, right: Sample, orb: number): Promise<number> {
  let a = left.utcMs; let b = right.utcMs;
  const fa = left.error - orb; const fb = right.error - orb;
  if (fa === 0) return a; if (fb === 0) return b;
  if (fa * fb > 0) throw new Error('unbracketed active boundary');
  for (let i = 0; i < YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS; i++) {
    if (b - a <= YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES * MINUTE_MS) return (a + b) / 2;
    const m = (a + b) / 2;
    const fm = (await sample(input, body, target, aspect, m)).error - orb;
    if (!Number.isFinite(fm)) throw new Error('non-finite boundary value');
    if (fa * fm <= 0) b = m; else a = m;
  }
  if (b - a > YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES * MINUTE_MS) throw new Error('active-boundary refinement exhausted');
  return (a + b) / 2;
}
async function refineMinimum(input: ScanInput, body: MovingBody, target: NatalAnchor, aspect: AspectType, left: Sample, center: Sample, right: Sample): Promise<Sample> {
  let a = left.utcMs; let b = right.utcMs;
  let best = center;
  for (let i = 0; i < YEARLY_TRANSIT_REFINEMENT_MAX_ITERATIONS; i++) {
    if (b - a <= YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES * MINUTE_MS) {
      return sample(input, body, target, aspect, (a + b) / 2);
    }
    const m1 = a + (b - a) / 3; const m2 = b - (b - a) / 3;
    const s1 = await sample(input, body, target, aspect, m1); const s2 = await sample(input, body, target, aspect, m2);
    if (s1.error < best.error) best = s1; if (s2.error < best.error) best = s2;
    if (s1.error < s2.error) b = m2; else a = m1;
  }
  if (b - a > YEARLY_TRANSIT_REFINEMENT_MAX_MINUTES * MINUTE_MS) throw new Error('exact-hit refinement exhausted');
  return sample(input, body, target, aspect, (a + b) / 2);
}

export async function scanTransitWindows(input: ScanInput): Promise<ActiveWindow[]> {
  const from = Date.parse(input.fromUtc); const to = Date.parse(input.toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error('invalid UTC forecast interval');
  // The moving-body position is independent of target and aspect. Cache each
  // body/time ephemeris call so the default 14-target × 5-aspect scan does not
  // recompute the same Swiss position dozens of times.
  const evaluationCache = new Map<string, Promise<EnginePoint>>();
  let evaluationCount = 0;
  const cachedEvaluator: TransitEvaluator = {
    evaluate(body, utcMs) {
      const key = `${body}:${utcMs}`;
      const cached = evaluationCache.get(key);
      if (cached) return cached;
      const result = (async () => {
        // Swiss calls are native/CPU-heavy. Yield periodically so Node timers,
        // health checks, and database-pool cleanup can run during long scans.
        evaluationCount += 1;
        if (evaluationCount % 32 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
        return input.evaluator.evaluate(body, utcMs);
      })();
      evaluationCache.set(key, result);
      return result;
    },
  };
  const scanInput = { ...input, evaluator: cachedEvaluator };
  const movers = input.movingBodies ?? DEFAULT_MOVING_BODIES;
  const targets = input.natalTargets ?? DEFAULT_NATAL_TARGETS;
  const anchors = input.natal.filter((n) => targets.includes(n.key));
  const out: ActiveWindow[] = [];
  for (const body of movers) for (const target of anchors) for (const aspect of Object.keys(ACTIVE_ORBS) as AspectType[]) {
    const orb = ACTIVE_ORBS[aspect]; const step = (FAST_BODIES.has(body) ? 6 : 24) * 60 * MINUTE_MS;
    const samples: Sample[] = [];
    for (let t = from; t < to; t += step) samples.push(await sample(scanInput, body, target, aspect, t));
    samples.push(await sample(scanInput, body, target, aspect, to));
    const groups: Sample[][] = [];
    for (const s of samples) {
      if (s.error <= orb) {
        const current = groups[groups.length - 1];
        if (current && s.utcMs - current[current.length - 1].utcMs <= step) current.push(s);
        else groups.push([s]);
      }
    }
    for (const active of groups) {
      const first = samples.indexOf(active[0]); const last = samples.indexOf(active[active.length - 1]);
      const start = first > 0 && samples[first - 1].error > orb
        ? await refineBoundary(scanInput, body, target, aspect, samples[first - 1], samples[first], orb) : active[0].utcMs;
      const end = last < samples.length - 1 && samples[last + 1].error > orb
        ? await refineBoundary(scanInput, body, target, aspect, samples[last], samples[last + 1], orb) : active[active.length - 1].utcMs;
      const candidateMinima: Sample[] = [];
      for (let i = first; i <= last; i++) {
        if (i > 0 && i < samples.length - 1 && samples[i].error <= samples[i - 1].error && samples[i].error <= samples[i + 1].error) candidateMinima.push(samples[i]);
      }
      const exactHits = [];
      for (const minimum of candidateMinima) {
        const i = samples.indexOf(minimum);
        const refined = await refineMinimum(scanInput, body, target, aspect, samples[i - 1], minimum, samples[i + 1]);
        if (refined.error < 0.1 && refined.utcMs >= from && refined.utcMs <= to) {
          const neighborhood = [await sample(scanInput, body, target, aspect, refined.utcMs - MINUTE_MS), refined, await sample(scanInput, body, target, aspect, refined.utcMs + MINUTE_MS)];
          exactHits.push({ id: '', exactUtc: canonicalInstant(refined.utcMs), exactError: refined.error, direction: directionFrom(neighborhood), retrograde: refined.point.retrograde, factId: '' });
        }
      }
      const uniqueExactHits = exactHits
        .sort((a, b) => a.exactUtc.localeCompare(b.exactUtc) || a.exactError - b.exactError)
        .filter((hit, index, all) => index === 0 || Date.parse(hit.exactUtc) - Date.parse(all[index - 1].exactUtc) > MINUTE_MS);
      const canonicalTransitId = `${body}.${target.key}.${aspect}`;
      const id = `yt.window.${canonicalTransitId}`;
      const retrograde = active.some((s) => s.point.retrograde);
      const segments = [{ startUtc: canonicalInstant(start), endUtc: canonicalInstant(end), direction: directionFrom(active) }];
      const minError = Math.min(...active.map((s) => s.error));
      const window: ActiveWindow = { id, canonicalTransitId, mover: body, target: target.key, aspectType: aspect,
        activeWindow: { startUtc: canonicalInstant(start), endUtc: canonicalInstant(end) }, minimumActiveError: minError,
        house: target.house, retrograde, segments, exactHits: uniqueExactHits, rawImportanceScore: 0, importanceScore: 0, importanceBand: 'omit', evidenceIds: [] };
      out.push(window);
    }
  }
  const sorted = out.sort((a, b) => a.canonicalTransitId.localeCompare(b.canonicalTransitId) || a.activeWindow.startUtc.localeCompare(b.activeWindow.startUtc));
  const passCounts = new Map<string, number>();
  return sorted.map((window) => {
    const passIndex = (passCounts.get(window.canonicalTransitId) ?? 0) + 1;
    passCounts.set(window.canonicalTransitId, passIndex);
    const exactHits = window.exactHits
      .sort((a, b) => a.exactUtc.localeCompare(b.exactUtc) || a.exactError - b.exactError || a.id.localeCompare(b.id))
      .map((hit) => ({ ...hit, id: `${window.canonicalTransitId}.${passIndex}.${hit.exactUtc.replace(/\.000Z$/, 'Z')}` }));
    const boundaries = [window.activeWindow.startUtc, ...exactHits.map((hit) => hit.exactUtc), window.activeWindow.endUtc]
      .sort((a, b) => a.localeCompare(b));
    const directions: TransitDirection[] = exactHits.length > 0
      ? ['applying', ...exactHits.slice(0, -1).map(() => 'separating' as TransitDirection), 'separating']
      : [window.segments[0]?.direction ?? 'indeterminate'];
    const segments = boundaries.slice(0, -1).map((startUtc, index) => ({ startUtc, endUtc: boundaries[index + 1], direction: directions[index] ?? 'indeterminate' }));
    return { ...window, passIndex, exactHits, segments };
  });
}
