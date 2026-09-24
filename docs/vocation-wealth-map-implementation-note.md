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

Remaining external gate:

- The existing Render staging environment supplied the configured n8n token and external staging `DATABASE_URL` in memory. Authenticated staging fixture smoke reached the master router and callback: disposable user 211, reading 1274, and correlation `23c29d82-9006-4c61-ad55-f50e6f85d531` returned callback HTTP 200, persisted approved state with nine sections, and appeared in authenticated `/api/profile/reports` as an approved Vocation report.
- The live staging PDF request returned 404 because Render is deployed at stale SHA `9e96c81090b2a9a23cbf39764fd17f839a57d413` from September 17, 2026, before the current Vocation PDF route. The local current implementation's dedicated PDF artifact is verified separately. Deployment of the current uncommitted implementation is the remaining external gate.
- Four broader facts-suite failures remain outside this Vocation launch change: dense-vs-sparse aspect count and stale Juno/Chiron retrograde reference expectations.
