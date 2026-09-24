# Vocation & Wealth Map implementation note

Date: September 23, 2026

Scope: Vocation & Wealth Map only.

Completed contracts:

- `vocation` is launch-enabled and priced at $39.
- Known birth time and saved timezone are required before VerifiedFacts construction, reading creation, purchase consumption, dispatch, or generation.
- `csg-vocation-career-windows-v1` emits exactly 24 calendar-month buckets beginning in the saved birth timezone, with deterministic UTC boundaries, stable IDs, movers, targets, aspects, directions, retrograde state, exact hits, local labels, evidence IDs, scores, and canonical ordering/hash.
- Timing targets are limited to MC, the 2nd-house ruler, the 10th-house ruler, Saturn, and Jupiter.
- `careerWindowsDeclared` is true only after pack validation, provenance validation, and ledger fact resolution.
- The application callback accepts approved/rejected callbacks with exact block-based section contracts and rejects unknown fact IDs, unknown reports, malformed callbacks, duplicate conflicts, and rejected callbacks without reasons.
- The n8n Vocation child finalizer now emits `approved` for paid judge passes, `rejected` with reasons for failures, the nine canonical camelCase section IDs, block-based sections, and non-empty fact IDs. It does not require editor approval for an automated pass.
- A dedicated Vocation PDF renderer emits a title, overview, all nine sections, career-window detail, and safety disclaimer.

Verification artifacts:

- `tests/reports/vocation-career-windows.test.ts`: 2 passing tests.
- Focused launch/callback/editor/PDF gate: 7 suites, 93 tests passing.
- n8n child fixture execution 296: approved callback shape verified.
- n8n child fixture execution 295: rejected callback with rejection reasons verified.
- `.hermes/evidence/vocation-fixture.pdf`: `%PDF-`, 6,321 bytes, 3 rendered pages; extracted text contains all required headings and disclaimer; visual inspection found no clipping, blank pages, or unreadable tables.
- `npm run typecheck:test`, `npm run build`, and `git diff --check`: passing.

External staging gate:

- Render staging service `srv-dae516lbedkc73bbsc80` is deployed from `f7a212b02c1d75c981b8f17f3ca862397b0de187` (`fix(vocation): normalize PDF unicode output`), deployment `dep-daq834142hec738m8qv0` reached `live` on September 24, 2026.
- Real staging n8n smoke execution 308 completed successfully through the master router and Vocation child. The callback persisted `approved` with nine sections for disposable reading 1279 and report correlation `2ac12d0e-8c0e-42bf-bdbe-22802cdddaca`.
- Authenticated staging `/api/profile/reports` returned the approved `vocation` report with all nine sections.
- Authenticated staging `/api/reports/1279/pdf` returned HTTP 200, `application/pdf`, `%PDF-`, 7,148 bytes, and three pages. Extracted text contained the title, overview, required report content, career windows, and safety disclaimer. Rendered-page inspection found no blank pages, clipping, broken pagination, unreadable text, or malformed layout.
- The live n8n report initially exposed a PDF Unicode failure on U+2011 and U+202F model punctuation; `src/lib/vocationPdf.ts` now normalizes those characters, the focused PDF replay passes, and the fix is deployed and verified live.
- Four broader facts-suite failures remain outside this Vocation launch change: dense-vs-sparse aspect count and stale Juno/Chiron retrograde reference expectations.
