import { compilePremiumNatalReport, buildNarrativePrompt, buildNarrativeFactPacks } from '@/lib/deterministicReportCompiler';
import { dispatchReport, __setFetch } from '@/lib/reportPipeline';
import type { VerifiedFactsV2, VerifiedFact, PositionValue } from '@/lib/reportFacts/types';

const pos = (key: string, label = key[0].toUpperCase() + key.slice(1), longitude = 10): VerifiedFact => ({
  id: `natal.${key}.position`, kind: 'position', source: 'swiss-ephemeris',
  display: `${label} at 10.00° Aries`,
  value: { key, label, longitude, degreeInSign: longitude, sign: 'aries', signLabel: 'Aries', house: 1, retrograde: false, dignity: null } satisfies PositionValue,
});
const makeLedger = (): VerifiedFactsV2 => {
  const positions = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','chiron','juno'].map((key, i) => pos(key, undefined, i + 1));
  const elements: VerifiedFact = { id: 'common.elements', kind: 'tally', source: 'derived-deterministic', display: 'Fire 12', value: { fire: 12 }, provenance: [] };
  const modalities: VerifiedFact = { id: 'common.modalities', kind: 'tally', source: 'derived-deterministic', display: 'Cardinal 12', value: { cardinal: 12 }, provenance: [] };
  const facts = Object.fromEntries([...positions, elements, modalities].map((fact) => [fact.id, fact]));
  return { schemaVersion: 'csg-report-facts-v2', reportType: 'natal', asOfDate: '2026-01-01', facts,
    common: { positions, northNode: positions[0].value as any, southNode: positions[0].value as any, juno: positions[11].value as any, elements, modalities, aspects: [], topAspectByBody: positions[0], patterns: [], houses: [], isSolarFallback: false }, reportData: {} };
};

describe('first deterministic report migration slice', () => {
  it('compiles stable factual skeleton including metadata and all deterministic tables', () => {
    const first = compilePremiumNatalReport(makeLedger());
    const second = compilePremiumNatalReport(makeLedger());
    expect(first).toEqual(second);
    expect(first.metadata.asOfDate).toBe('2026-01-01');
    expect(first.tables).toEqual(expect.objectContaining({ planets: expect.any(Array), aspects: [], houses: [], patterns: [] }));
  });

  it('does not allow model prose or fields to alter factual displays', () => {
    const compiled = compilePremiumNatalReport(makeLedger());
    const before = JSON.stringify(compiled.tables);
    expect(() => buildNarrativePrompt(compiled, 'identity', { sign: 'Pisces', degree: '29°', prose: 'fake' })).toThrow(/factual/i);
    expect(JSON.stringify(compiled.tables)).toBe(before);
  });

  it('fails closed for missing or invalid ledger', () => {
    expect(() => compilePremiumNatalReport(undefined as unknown as VerifiedFactsV2)).toThrow(/failed/i);
    const invalid = makeLedger();
    (invalid.facts['natal.sun.position'].value as PositionValue).longitude = 999;
    expect(() => compilePremiumNatalReport(invalid)).toThrow(/invalid|longitude/i);
  });

  it('sends the writer only compact fact packs at the adapter seam', async () => {
    const ledger = makeLedger();
    const compiled = compilePremiumNatalReport(ledger);
    let body: any;
    process.env.N8N_REPORT_WEBHOOK_URL = 'https://n8n.invalid/report';
    process.env.REPORT_PIPELINE_TOKEN = 'test-token';
    __setFetch((async (_url, init) => { body = JSON.parse(String(init?.body)); return new Response('{}', { status: 200 }); }) as typeof fetch);
    await dispatchReport({ reportId: 'r1', reportType: 'natal', tier: 'free', birthData: { dob: '2026-01-01', birthTime: null, place: 'Test', lat: 0, lon: 0, tz: 'UTC', solarFallback: false }, verifiedFacts: ledger, writerInput: { narrativeFactPacks: buildNarrativeFactPacks(compiled) }, promptSlug: '', callbackUrl: 'https://app.invalid/callback' });
    expect(body.verifiedFacts).toEqual(ledger);
    expect(body.writerInput).toEqual({ narrativeFactPacks: buildNarrativeFactPacks(compiled) });
    expect(JSON.stringify(body.writerInput)).not.toContain('csg-report-facts-v2');
    delete process.env.N8N_REPORT_WEBHOOK_URL;
    delete process.env.REPORT_PIPELINE_TOKEN;
  });

  it('emits only approved facts in compact section packs', () => {
    const packs = buildNarrativeFactPacks(compilePremiumNatalReport(makeLedger()));
    expect(packs.every((pack) => pack.facts.every((fact) => fact.id.startsWith('natal.')))).toBe(true);
    expect(JSON.stringify(packs)).not.toMatch(/reportData|elements|modalities|patterns|houses|longitude|provenance/);
  });
});
