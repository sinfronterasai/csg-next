const fs = require('node:fs');
const path = require('node:path');

const SLOT_IDS = ['identity', 'inner-world', 'integration', 'dynamics'];
const WORKFLOW = path.join(__dirname, 'compact-report.workflow.json');
const clone = value => JSON.parse(JSON.stringify(value));
function fail(message) { throw new Error(`compact report contract failed: ${message}`); }

function loadWorkflow() { return JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')); }

function validateInput(input) {
  if (!input || !input.verifiedFacts || typeof input.verifiedFacts !== 'object') fail('verifiedFacts is required');
  if (!input.deterministic || !input.deterministic.tables || !input.deterministic.skeleton) fail('deterministic tables and skeleton are required');
  if (!Array.isArray(input.narrativeFactPacks) || input.narrativeFactPacks.length !== SLOT_IDS.length) fail('exactly four narrative fact packs are required');
  const seen = new Set();
  for (const pack of input.narrativeFactPacks) {
    if (!pack || !SLOT_IDS.includes(pack.sectionId)) fail(`unknown or disallowed slot ${pack?.sectionId}`);
    if (seen.has(pack.sectionId)) fail(`duplicate slot ${pack.sectionId}`);
    seen.add(pack.sectionId);
    if (!pack.wordLimit || !Number.isInteger(pack.wordLimit.max) || pack.wordLimit.max < 1 || pack.wordLimit.max > 700) fail(`invalid word limit ${pack.sectionId}`);
    if (!Array.isArray(pack.facts)) fail(`facts missing for ${pack.sectionId}`);
  }
  if (seen.size !== SLOT_IDS.length) fail('required slots are missing');
  return clone(input);
}

function validateSlot(response, pack) {
  if (!response || typeof response !== 'object' || response.sectionId !== pack.sectionId || !Array.isArray(response.blocks) || response.blocks.length < 1) fail(`invalid returned narrative slot ${pack.sectionId}`);
  const allowedFacts = new Set(pack.facts.map(f => f.id));
  for (const block of response.blocks) {
    if (!block || typeof block.prose !== 'string' || !block.prose.trim() || !['narrative', 'reflection', 'practical'].includes(block.role)) fail(`malformed block in ${pack.sectionId}`);
    if (!Array.isArray(block.factIds) || block.factIds.some(id => !allowedFacts.has(id))) fail(`unsupported fact ID in ${pack.sectionId}`);
    if (block.prose.split(/\s+/).filter(Boolean).length > pack.wordLimit.max) fail(`word limit exceeded in ${pack.sectionId}`);
  }
  return { sectionId: pack.sectionId, blocks: clone(response.blocks) };
}

async function runCompactCompiler(input, narrativeCall, repairCall) {
  const state = validateInput(input);
  if (typeof narrativeCall !== 'function') fail('narrativeCall is required');
  const packs = SLOT_IDS.map(id => state.narrativeFactPacks.find(pack => pack.sectionId === id));
  const calls = [];
  const repairs = [];
  const blocks = [];
  for (const pack of packs) {
    calls.push({ sectionId: pack.sectionId, maxTokens: 700 });
    let response = await narrativeCall(clone(pack));
    try {
      blocks.push(validateSlot(response, pack));
    } catch (error) {
      if (typeof repairCall !== 'function') throw error;
      repairs.push({ sectionId: pack.sectionId, attempt: 1 });
      calls.push({ sectionId: pack.sectionId, maxTokens: 700, repair: true });
      response = await repairCall(clone(pack), { sectionId: pack.sectionId, error: error.message });
      blocks.push(validateSlot(response, pack));
    }
  }
  if (blocks.length !== SLOT_IDS.length || new Set(blocks.map(block => block.sectionId)).size !== SLOT_IDS.length) fail('final quality gate rejected incomplete slots');
  return { schemaVersion: 'csg-compact-report-callback-v1', status: 'approved', reportType: 'natal', skeleton: clone(state.deterministic.skeleton), tables: clone(state.deterministic.tables), blocks, calls, repairs };
}

module.exports = { SLOT_IDS, loadWorkflow, runCompactCompiler, validateInput, validateSlot };
