# PIKE IMPLEMENTATION BRIEF — REPORT QUALITY REMEDIATION V2

Owner: PIKE (development)
Content/product authority: John
Date: 2026-08-25
Base code: `sinfronterasai/csg-next` `origin/main` at `db25c366d158407d3cb6ab5fcdf4988dbc0f7231`
Launch status: **BLOCKED. Do not enable report purchases or move the domain.**

## START HERE / READ ORDER

1. This file.
2. `product/reports/briefs/global-generation-brief.md` — now includes the mandatory narrative-first interpretation contract.
3. `product/reports/briefs/global-quality-bar.md` — now includes `narrativeDepth` as D8.
4. `report-review/QUALITY-REMEDIATION-PLAN.md` — evidence and report-by-report failures.
5. `product/reports/00-master-index.md`, `00-shared-foundation.md`.
6. Per-report build spec + brief + prompt for 01, 02, 03, 04, 08, 09, 10, 11.
7. Existing integration brief and n8n contract.

## PRODUCT OUTCOME — NON-NEGOTIABLE

Customers are not buying planetary coordinates. They are buying an interpretation of their
unique path.

- Deterministic code supplies every celestial fact, degree, aspect, date, score, driver, and
  derived label.
- Kimi turns those facts into a cohesive narrative about this person's gifts, tensions,
  developmental path, timing, choices, and practical next steps.
- Every substantive chapter moves through:

```text
verified evidence
-> human meaning
-> unique synthesis/interplay
-> agency and practical application
```

- The report must connect chapters into one developing story rather than restart as isolated
  placement definitions.
- Narrative may use light metaphor, but may never invent biography, trauma, occupations,
  relationships, or past events.
- A cold data dump fails. Purple prose without evidence also fails.

## VERIFIED CURRENT ROOT CAUSE

At `origin/main`:

- `src/lib/chartEngine.ts` already computes `degreeInSign`, longitude, dignity, retrograde,
  houses, angles, and planets.
- `src/lib/transit.ts` already contains body, aspect, and Moon-phase primitives.
- `src/lib/reportEngine.ts` contains potentially reusable deterministic calculations, but
  also contains hardcoded customer prose and several formatting/logic defects. Do not route
  that hardcoded prose into the premium pipeline.
- `src/lib/reportVerifiedFacts.ts` strips `degreeInSign` and most derived facts from the
  dispatched payload.
- All report types except `yearlytransit` receive the same thin natal payload.
- `yearlytransit` receives only one current-day `transitSnapshot`, not a 12-month event ledger.
- Existing n8n validators only require a non-empty `verifiedFacts` object.
- Per-report `.brief.md` facts-to-cite contracts are not enforced as runtime schemas.
- The linter permits `{{MISSING_FACT:...}}`, validates loose numbers rather than exact fact
  references, and does not enforce report page/module coverage.
- The judge gets only aggregate gate names, returns one aggregate scorecard, and currently
  over-awards 5/5 scores.
- Full Cosmic is treated as a normal writer child, producing a three-section wrapper instead
  of assembling approved component artifacts.

## ARCHITECTURE DECISION

Use this boundary:

```text
csg-next compute layer
  -> immutable VerifiedFactsV2 + deterministic render modules
n8n writer
  -> narrative prose only, around exact fact IDs
n8n deterministic validation
  -> exact structure/facts/length/placeholders/duplication
n8n judge
  -> per-section qualitative scoring including narrativeDepth
human editor
  -> paid approval
csg-next renderer/assembler
  -> final web/PDF product
```

Do not add more hardcoded one-line interpretation strings to `reportEngine.ts` as the fix.
Reuse its computation where correct, move it into deterministic services, and keep customer
narrative in the writer/editor pipeline.

## WORKSTREAM A — VERIFIED FACTS V2

### A1. Versioned normalized ledger

Create a typed, versioned contract such as:

```ts
interface VerifiedFact {
  id: string;                 // stable, e.g. natal.venus.position
  kind: string;
  source: 'swiss-ephemeris' | 'derived-deterministic';
  display: string;            // renderer-owned, e.g. Venus at 18.68° Taurus in 9th house
  value: unknown;
  provenance?: string[];      // source fact IDs for derived values
}

interface VerifiedFactsV2 {
  schemaVersion: 'csg-report-facts-v2';
  reportType: N8nReportType;
  asOfDate: string;
  common: {...};
  facts: Record<string, VerifiedFact>;
  reportData: Record<string, unknown>;
}
```

Exact shape may differ, but acceptance requires stable IDs, exact display values, provenance,
and report-specific validation.

### A2. Preserve report-ready position fields

Every planet, derived point, angle, and house cusp includes:

- `longitude` (0–360 internal calculation)
- `degreeInSign` (0–<30 customer display)
- `sign`, `signLabel`
- `house` where valid
- `retrograde`
- `dignity` enum or null
- deterministic `display`

Prohibit customer prose from rendering raw longitude as sign degree. Add tests around 0° and
29.99° boundaries.

### A3. Common deterministic derived layer

Compute and expose:

- ASC, DSC, MC, IC and rulers.
- Chart ruler and condition.
- North + South Nodes; Juno; Part of Fortune where required by the locked specs.
- Major/minor natal aspects with stable IDs, orb, exactness, and involved bodies.
- Top aspects per body.
- Detected chart patterns with stable IDs, participants, and tightness.
- Element/modality tallies under one documented inclusion rule.
- Computed Moon phase.
- Dignity/rulership facts; null forbids dignity language.

Never rely on Kimi's astrological memory for any of the above.

### A4. Report-specific payloads

Implement a schema and builder per routed report:

- Natal: full common derived layer.
- Relationship: Venus/Mars/Moon/Saturn aspects, Mercury–Venus dynamic, Juno, DSC/7th
  ruler/7th occupants, five deterministic dimension scores with explicit driver fact IDs.
- Love Blueprint: deterministic archetype code + drivers, Venus/Mars aspects,
  Moon–Venus dynamic, DSC ruler/occupants, Juno/Saturn, Chiron aspects, North Node.
- Love Timing: 12-month love-scoped transit hits with exact dates/orbs, Venus returns,
  love ingresses, eclipse-angle flags, active/quiet months, monthly scores + drivers.
- Yearly Transit: 12-month transit ledger, retrograde stations, ingresses, eclipses,
  life-node/return flags, monthly topic scores + drivers, quiet-month markers.
- Vocation: MC/10th/2nd/6th rulers and aspects, Saturn/Jupiter/Pluto relevance,
  deterministic career archetype + drivers, exact favorable 24-month transit windows.
- Karmic: North/South axis, nodal rulers and condition, nodal aspects/squares, optional
  Chiron ties. Dignity language only from explicit non-null facts.
- Full Cosmic: no ordinary raw-chart payload. It receives approved immutable component
  versions and a cross-report fact ledger only.

### A5. Deterministic dates and retries

Persist an explicit `asOfDate`/period start in the immutable reading snapshot. Report retries
must reuse the same period and facts rather than shifting with `Date.now()`.

## WORKSTREAM B — PREFLIGHT SCHEMAS

Before dispatch or before writer execution, validate the exact report-specific schema.

- A non-empty object is not sufficient.
- Missing required data returns an internal `input_incomplete`/`preflight_failed` state with
  machine-readable missing fields.
- Never place missing-fact notices in customer prose.
- Optional conditional sections are declared explicitly and omitted/short-rendered according
  to schema rules.
- Purchase remains consumed safely and retryable after a technical preflight repair; do not
  weaken payment/idempotency behavior already reviewed at `db25c36`.

Add fixtures and negative tests for every required field group.

## WORKSTREAM C — N8N WRITER / REVISION / JUDGE V2

Source package: `product/reports/n8n/` in the report handoff workspace.

### C1. Compile the real brief

For each child workflow, compile:

- `global-generation-brief.md`
- `global-quality-bar.md`
- its per-report `.brief.md`
- its per-report `.prompt.md`
- the machine-readable section schema and required fact IDs

Do not rely on prompt prose alone for validation.

### C2. Narrative output contract

Each substantive section returns structured paragraphs/blocks, for example:

```json
{
  "id": "howYouLove",
  "blocks": [
    {
      "role": "evidence|meaning|synthesis|agency",
      "prose": "...",
      "factIds": ["natal.venus.position", "natal.aspect.venus-saturn"]
    }
  ]
}
```

The exact schema may differ, but it must let validators prove that narrative meaning and
synthesis are grounded in exact facts.

Narrative acceptance:

- Opening has one earned, specific wow insight.
- At least one supplied interaction/synthesis appears in every major interpretive chapter.
- Later chapters deepen or complicate the report thesis.
- Practical guidance cites the pattern it responds to.
- No invented biography.
- No cold placement list.
- No unsupported purple prose.

### C3. Deterministic hard gates

Add hard failures for:

- `{{MISSING_FACT:...}}` or any unresolved token.
- Wrong/missing/duplicate/out-of-order sections.
- Missing required fact IDs.
- A cited fact ID that does not resolve exactly.
- Display text inconsistent with the fact's renderer-owned display.
- Missing scores or score drivers.
- Missing dates in timing products.
- Wrong word/module bounds.
- Intra-report and cross-report duplicate substance.
- Unsupported dignity/rulership/derived claims.
- Missing narrative roles/arc according to the section schema.

Do not let the LLM judge override deterministic failures.

### C4. Revision prompt

The revision writer receives the same global brief, per-report brief, section schema, narrative
contract, exact facts, and all deterministic issues. It gets one bounded revision. It must not
receive only the error list and current draft.

### C5. Per-section judge

Implement the locked rubric per section:

- Eight hard gates.
- `precision`, `insightDensity`, `voiceFit`, `empowerment`, `personalization`, `clarity`,
  `cohesion`, and new `narrativeDepth`.
- Paid: every dimension >=4 plus human editor.
- Free: no dimension <3; Natal uses 5% audit.
- One evidence-based justification for every score.
- Aggregate verdict computed from section results.

The judge prompt receives the full quality bar and relevant per-report brief.

### C6. Private rejected-draft retention

Customer callbacks continue to withhold rejected content. Add a separate sanitized private
review artifact/path so editors can diagnose rejected drafts without exposing birth data,
secrets, raw prompts, or payloads.

## WORKSTREAM D — FULL COSMIC ASSEMBLY

Remove `fullcosmic` from ordinary standalone generation.

Requirements:

1. Require immutable approved versions of Natal + Relationship + Love Blueprint + Yearly
   Transit + Vocation.
2. Assemble those artifacts without regenerating their prose.
3. Build a personalized TOC and report dividers.
4. Build a cross-report fact ledger with source report/section/fact IDs.
5. Draft 3–5 cross-report insights; each joins at least two source artifacts.
6. Collectively cover identity, love, timing, and vocation.
7. Require John/editor ownership of the final Synthesis Index.
8. Run cross-artifact duplicate lint.
9. Verify the complete rendered 40–55-page book.
10. Fail closed if any component is missing, rejected, unapproved, or version-mismatched.

## WORKSTREAM E — REAL PRODUCT VALUE / RENDERING

Do not reach page targets with filler. Implement/verify real deterministic modules:

- Designed cover + one specific wow insight.
- Placement/evidence tables.
- Chart wheel and relevant axis/aspect visuals.
- Scores with visible drivers.
- Timing calendars and `.ics` data for timing products.
- Exercises/action plans tied to fact IDs.
- Summary/compass cards.
- TOC and section dividers for bundles.
- Save, re-download, sharing, mobile, print/PDF, and accessibility behavior.

Resolve page maps against the existing word bounds. If a target cannot be met with useful
modules, propose an honest revised target to John before implementation.

## WORKSTREAM F — TEST AND REVIEW CORPUS

Add deterministic fixtures for at least:

1. Known-time ordinary chart.
2. Unknown-time/solar fallback.
3. Sparse-aspect chart.
4. Dense-aspect/pattern chart.
5. Quiet transit year.
6. Event-heavy transit year.
7. 0°/29° boundary placements.
8. Retrograde and null-dignity cases.

Each report type must pass at least three materially different fixtures. Tests verify facts,
schema, narrative grounding/coverage, state transitions, privacy, and rendering—not merely
that a model returned JSON.

## DEPENDENCY ORDER

```text
P0 VerifiedFactsV2 + schemas + fixtures
P1 Natal
P2 Relationship
P3 Love Blueprint
P4 Karmic & Shadow
P5 Vocation & Wealth
P6 Love Timing
P7 Yearly Transit
P8 Full Cosmic assembly
P9 final editor UI/PDF integration and production round trip
```

Do not start Full Cosmic until required component artifacts pass.

## REQUIRED DELIVERABLES FROM PIKE

1. A branch based on `origin/main` `db25c36`; do not use John's behind/uncommitted local
   working tree.
2. Code commits with tests and no credential values.
3. Generated n8n workflow source/JSON updates and test results.
4. Any DB migration required for versioned facts/component manifests, with rollback.
5. A machine-readable contract/fixture package.
6. Test output for unit, integration, TypeScript, build, DOM, and security audit.
7. A change ledger mapping every item in this brief to code/tests.
8. A regenerated private synthetic review pack only after P0–P7 pass.
9. No PBX deployment, Render change, domain cutover, or purchase enablement without John/user
   review and explicit approval.

## DEFINITION OF DONE

- Facts are complete, exact, normalized, and deterministic.
- Narrative is rich, coherent, personalized, and grounded—not a fact dump.
- No unsupported biography or celestial inference.
- Every report passes exact schema and per-section gates.
- Paid outputs stop at trustworthy `needs_editor`.
- John can review the complete rendered product, not only prose callbacks.
- Full Cosmic is a genuine assembled book.
- All eight reports pass the multi-fixture corpus and final visual review.
