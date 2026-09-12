const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWorkflow, runCompactCompiler } = require('./harness.cjs');

const base = {
  verifiedFacts: {
    schemaVersion: 'csg-report-facts-v2',
    common: { positions: [{ id: 'natal.sun.position', value: { key: 'sun', label: 'Sun', signLabel: 'Aries', degreeInSign: 10, house: 1, retrograde: false, dignity: null }, display: 'Sun — 10° Aries — House 1' }] },
  },
  deterministic: { tables: { planets: [{ body: 'Sun' }], aspects: [], houses: [], patterns: [] }, skeleton: { reportType: 'natal' } },
  narrativeFactPacks: ['identity', 'inner-world', 'integration', 'dynamics'].map(sectionId => ({ sectionId, role: 'interpreter', wordLimit: { min: 1, max: 120 }, facts: [{ id: 'natal.sun.position', label: 'Sun', display: 'Sun — 10° Aries — House 1' }] })),
};
const prose = id => ({ sectionId: id, blocks: [{ role: 'narrative', prose: `Approved prose for ${id}.`, factIds: ['natal.sun.position'] }] });

 test('workflow has four bounded primary calls and no table LLM node', () => {
  const workflow = loadWorkflow();
  assert.equal(workflow.name, 'CSG Compact Premium Natal Report (private draft)');
  assert.equal(workflow.nodes.filter(n => n.type.includes('lmChat')).length, 0);
  assert.equal(workflow.nodes.filter(n => n.name === 'Narrative Slot Call').length, 1);
  assert.equal(workflow.nodes.find(n => n.name === 'Narrative Slot Call').parameters.options.maxTokens, 700);
  assert.equal(workflow.nodes.find(n => n.name === 'Narrative Slot Call').parameters.options.maxCalls, 4);
  assert.ok(workflow.nodes.some(n => n.name === 'Accumulate Validated Slot'));
 });

test('happy path makes exactly one bounded call per allowed compiler slot', async () => {
  const result = await runCompactCompiler(base, async pack => prose(pack.sectionId));
  assert.equal(result.calls.length, 4);
  assert.deepEqual(result.calls.map(c => c.sectionId), ['identity', 'inner-world', 'integration', 'dynamics']);
  assert.deepEqual(result.blocks.map(b => b.sectionId), ['identity', 'inner-world', 'integration', 'dynamics']);
  assert.deepEqual(result.tables, base.deterministic.tables);
});

test('unknown IDs and missing slots reject before any narrative call', async () => {
  await assert.rejects(() => runCompactCompiler({ ...base, narrativeFactPacks: base.narrativeFactPacks.slice(0, 3) }, async pack => prose(pack.sectionId)), /exactly four|required slots/i);
  await assert.rejects(() => runCompactCompiler({ ...base, narrativeFactPacks: [...base.narrativeFactPacks.slice(0, 3), { ...base.narrativeFactPacks[3], sectionId: 'planetTable' }] }, async pack => prose(pack.sectionId)), /unknown|allowlist/i);
});

test('strict slot validation rejects unsupported fact IDs and does not certify the report', async () => {
  await assert.rejects(() => runCompactCompiler(base, async pack => ({ ...prose(pack.sectionId), blocks: [{ role: 'narrative', prose: 'bad', factIds: ['invented.fact'] }] })), /unsupported|fact/i);
});

test('AI output cannot alter deterministic tables', async () => {
  const result = await runCompactCompiler(base, async pack => ({ ...prose(pack.sectionId), tables: { planets: [{ body: 'HACKED' }] } }));
  assert.deepEqual(result.tables, base.deterministic.tables);
  assert.equal(JSON.stringify(result).includes('HACKED'), false);
});

test('one failed slot gets at most one targeted repair, never a report-wide revision', async () => {
  let attempts = 0;
  const result = await runCompactCompiler(base, async pack => {
    attempts++;
    if (pack.sectionId === 'integration' && attempts === 3) return { sectionId: 'wrong', blocks: [] };
    return prose(pack.sectionId);
  }, async pack => prose(pack.sectionId));
  assert.equal(result.calls.length, 5);
  assert.equal(result.repairs.length, 1);
  assert.deepEqual(result.repairs[0], { sectionId: 'integration', attempt: 1 });
});
