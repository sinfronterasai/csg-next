# Plan: Launch the Vocation & Wealth Map Paid Report

One-line goal: A customer with a known birth time can purchase the $39 Vocation & Wealth Map, receive a deterministic 24-month professional timing report, view it on the web, and download a readable PDF without requiring human approval for successful completion.

## Classification

Track: Feature + Integration — the repository contains partial Vocation facts, paid-report checkout, n8n routing, persistence, and PDF paths, but Vocation is not launch-enabled and current callback contracts do not complete end to end (verified: `src/lib/reportFacts/*`, `src/app/api/reports/*`, `src/lib/launch/allowlist.ts`, n8n workflows `e188230ec42d5507` and `5aa8605ae98c5735`).

Parked: unknown-time Vocation reports, user-selected timing dates, other premium reports, Full Cosmic Profile changes, and a renderer replacement.

## Decisions

- Use the verified-facts pipeline, not the legacy seeded-timing `buildVocationReport` path (user; verified: `src/lib/reportFacts/build.ts`, `src/lib/reportEngine.ts:341-413`).
- Require a known birth time before purchase consumption, reading creation, dispatch, or generation (user; verified: `src/lib/yearlyTransit/compiler.ts`, `src/lib/constellations/natal.ts`).
- Start timing on the generation date in the saved birth-chart timezone (user).
- Generate exactly 24 calendar months (user; verified product scope: `docs/specs/premium-reports-plan-pike.md:87-92`).
- Restrict timing to MC, the 2nd-house ruler, the 10th-house ruler, Saturn, and Jupiter (user).
- Use $39 as the single launch price (verified: `src/lib/reportEngine.ts:73`, `docs/specs/premium-reports-plan-pike.md:214-221`; the earlier $55 entry is stale).
- Include a web report and downloadable PDF (user; verified: `src/components/reports/ReportResult.tsx`, `src/lib/reportPdf.ts`).
- Approved automated judge results release immediately; human review is corrective-only and never a completion prerequisite (user).
- Reuse and align n8n workflows `5aa8605ae98c5735` and `e188230ec42d5507` (verified: connected n8n inspection).

## Requirements

1. Add Vocation to the server launch allowlist, checkout path, reports UI, and pricing copy.
2. Reject unknown-time or missing-time charts before consuming a paid purchase.
3. Build a versioned deterministic career-window pack with stable IDs, movers, targets, aspects, orb policy, UTC boundaries, exact hits, directions, retrograde state, local labels, evidence IDs, scores, and canonical ordering.
4. Use the generation-date local calendar month in the saved birth timezone as the start and emit exactly 24 ordered month buckets.
5. Set `careerWindowsDeclared` true only after schema and provenance validation pass.
6. Ensure every window fact and driver resolves in `ledger.facts`.
7. Keep only MC, 2nd-house ruler, 10th-house ruler, Saturn, and Jupiter career timing targets.
8. Align n8n output with `/api/reports/pipeline-complete`: approved or rejected status, exact section IDs, block-based sections, prose, and valid fact IDs.
9. Paid judge passes must callback `approved`; rejected reports remain hidden with rejection reasons. Corrective rework may be held and retried without double charging.
10. Render the nine required sections: cover thesis, career archetype, public role, money psychology, daily work, growth engine, legacy power, career compass, and launch windows.
11. Provide a readable PDF with title, overview, sections, career windows, and disclaimer.
12. Preserve customer safety language and reject guaranteed employment, income, wealth, or fatalistic claims.

## Known Current Blockers

- Vocation preflight currently fails because `careerWindowsDeclared` is false (verified: `src/lib/reportFacts/evidence.ts:98`, `src/lib/reportFacts/schemas.ts:919-923`).
- Vocation is absent from `LAUNCH_PAID_TYPES` (verified: `src/lib/launch/allowlist.ts:17-24`).
- The reports UI does not list Vocation (verified: `src/app/reports/ReportsView.tsx:22-41`).
- n8n paid success currently emits `needs_editor`, while the app callback accepts only `approved` and `rejected` (verified: n8n `e188230ec42d5507`; `src/app/api/reports/pipeline-complete/route.ts:19-22,142-143`).
- n8n currently emits flat sections while the app callback validator expects block-based sections with `factIds` (verified: n8n `Finalize Judged Result`; `src/app/api/reports/pipeline-complete/route.ts:25-79`).
- The legacy Vocation path uses a seeded month offset instead of real transit windows (verified: `src/lib/reportEngine.ts:341-413`).

## Data & State Changes

- Add a versioned deterministic Vocation career-window pack to the verified-facts snapshot.
- Persist generation local date, UTC period, display timezone, target IDs, and canonical window hash.
- Preserve old approved report snapshots; do not mutate them when the algorithm changes.
- Verify in Phase 1 whether existing `readings.result` JSON is sufficient before adding a relational migration (assumed: existing report snapshots support JSON metadata; verify: `src/lib/profile/store.ts`, `src/app/api/reports/generate/route.ts`).
- Rollback is allowlist removal and application rollback; do not delete report data.

## Callback Contract

The Vocation callback must contain `reportId`, `status`, `sections`, `judge`, `editorNote`, and `rejectReasons`.

Each section must contain `id` and `blocks`. Each block must contain `role`, `prose`, and non-empty `factIds`.

Automated pass: `approved`, immediately customer-visible.

Automated failure: `rejected`, hidden, with non-empty `rejectReasons`.

Corrective review: internal hold/rework flow only; it must not force every successful report through a human approval step.

## Verification

Run from `C:/Users/Ethan/cosmicnav/csg-next-main`:

```bash
npm test -- --runInBand tests/reports/factsV2.test.ts tests/reports/factsV2-independent-ephemeris.test.ts
npm test -- --runInBand tests/launch/reports-allowlist.test.ts tests/launch/allowlist.test.ts
npm test -- --runInBand tests/reports/pipeline-callback-route.test.ts tests/reports/editor-decision.test.ts
npm test -- --runInBand tests/reports/report-pdf.test.tsx tests/reports/pdf-adapter.test.ts
npm run typecheck:test
npm run build
git diff --check
```

Additional required checks:

- Known-time fixture reaches `preflightReport("vocation", ledger).status === "complete"`.
- Unknown-time fixture consumes no purchase and dispatches nothing.
- Identical snapshot and generation date produce identical career-window hashes.
- UTC/local date boundary uses the saved birth timezone.
- Exactly 24 month keys are present.
- Every timing fact ID resolves.
- Unrelated transit targets are excluded.
- Approved paid callback makes the report visible without editor action.
- Rejected, held, duplicate, conflicting, malformed, and unknown-report callbacks behave safely.
- PDF begins with `%PDF-`, contains the title, required headings, timing labels, and disclaimer.
- Every PDF page is rendered and visually checked for clipping, broken pagination, blank pages, and unreadable tables.
- One real staging smoke runs through the connected n8n master router and reads the final callback state back from the application.

## Build Phases

- [x] Phase 1: Freeze baseline and write red contracts
      Done when: focused baseline tests run, current callback mismatches are captured, and red tests exist for known-time rejection, launch availability, 24-month shape, callback shape, and automatic paid approval.
      Files: `tests/reports/`, `tests/launch/`, `tests/reports/pipeline-callback-route.test.ts`, implementation note under `docs/`.

- [x] Phase 2: Build deterministic Vocation career windows
      Done when: a fixed known-time fixture produces a complete ledger, `careerWindowsDeclared === true`, exactly 24 month buckets, stable canonical JSON, and no dangling evidence IDs.
      Files: `src/lib/reportFacts/`, new Vocation timing module, `src/lib/yearlyTransit/` integration, focused golden-vector tests.

- [x] Phase 3: Align n8n and application callbacks
      Done when: a real or fixture-backed approved Vocation callback persists and exposes the report without editor action, while rejected callbacks remain hidden.
      Actions: update n8n Vocation finalizer and/or adapter to emit approved/rejected and block-based sections; update app callback validators and idempotency tests; execute through master workflow `5aa8605ae98c5735`.

- [x] Phase 4: Enable paid launch and eligibility gates
      Done when: Vocation appears as a $39 product, checkout accepts it, known-time validation happens before consumption, expected SKU is `report-vocation`, and duplicate/retry protections pass.
      Files: `src/lib/launch/allowlist.ts`, `src/app/reports/ReportsView.tsx`, pricing copy, checkout/generation routes, launch tests.

- [x] Phase 5: Build web and PDF presentation
      Done when: approved Vocation reports render all nine sections on the web and produce a readable PDF with timing tables and disclaimer.
      Files: `src/components/reports/`, `src/lib/reportPdf.ts`, `src/lib/reportPdfAdapter.ts`, approved-report/PDF routes, focused component and artifact tests.

- [x] Phase 6: Run paid end-to-end smoke
      Done when: a known-time staging fixture flows through entitlement verification, verified facts, n8n, callback, persistence, web display, and PDF readback without manual approval.
      Actions: use environment-resolved credentials only; record correlation IDs, not secrets; verify n8n routing, callback state, customer surface, PDF bytes, extracted text, and rendered pages.

- [x] Phase 7: Release gate and rollback readiness
      Done when: focused tests, full relevant suites, typecheck, build, diff check, live callback verification, PDF inspection, deployed SHA verification, and blind final critique pass.
      Rollback: remove `vocation` from the launch allowlist and revert the application release without deleting report snapshots.

## Execution Evidence (September 23, 2026)

- Phase 1: focused launch, callback, editor-decision, PDF, and Vocation contract tests pass; unknown-time preflight and launch availability have explicit coverage.
- Phase 2: `tests/reports/vocation-career-windows.test.ts` passes. The known-time fixture produces `careerWindowsDeclared === true`, exactly 24 month buckets, stable repeated hashes, resolved timing facts, and a complete Vocation preflight. The generated fixture hash is `33790d38bdd27028c59d5815beb24ee81c43f8216c062135764c0a6bb6ebc2c6`.
- Phase 3: the child n8n workflow `e188230ec42d5507` was updated and published. Fixture execution `296` returned `approved`, the exact nine camelCase section IDs, block-based sections, non-empty fact IDs, empty `rejectReasons`, and no editor gate. Fixture execution `295` returned `rejected` with non-empty rejection reasons for malformed/missing facts. The Render staging environment supplied the existing app-to-n8n token in memory; authenticated master execution reached the Vocation child. The first live run exposed an 88K-token writer prompt and empty model output; compact fact-pack prompts and object-shaped writer normalization were published, then the live child generated a complete object-shaped nine-section draft. The remaining live run failure was downstream staging-service availability/PDF deployment, not router authentication.
- Phase 4: `vocation` is in the server paid allowlist, checkout/generation pipeline, Reports UI, and `$39` pricing copy. Focused allowlist tests pass. Generation builds and validates VerifiedFacts before consuming the purchase.
- Phase 5: `src/lib/vocationPdf.ts` now generates a dedicated Vocation PDF. Fixture artifact `.hermes/evidence/vocation-fixture.pdf` is 6,321 bytes, begins with `%PDF-`, has 3 rendered pages, and extracted text contains the title, Overview, all nine required headings, Career Windows, and Disclaimer. Rendered-page visual inspection found no clipping, blank pages, or unreadable tables.
- Broad regression: the focused launch/callback/PDF/typecheck/build gate passes: 7 suites, 93 tests; `npm run typecheck:test`; `npm run build`; and `git diff --check`. The broader facts suite still has four unrelated pre-existing ephemeris/reference expectation failures (dense-vs-sparse aspect count, Juno retrograde, Chiron retrograde, and independent ephemeris Juno retrograde).
- Phase 6: authenticated live staging smoke completed through the real n8n master and Vocation child. Execution `310` completed successfully with a corrected Santa Cruz, California snapshot. Disposable staging user `217`, reading `1280`, and report correlation `0bf34ad0-ef00-441c-824d-e9b991b89098` persisted `pipeline_status=approved`, callback status `approved`, and nine sections; authenticated `/api/profile/reports` returned the approved Vocation report with its deterministic coverage, featured-period, and appendix presentation. Authenticated `/api/reports/1280/pdf` returned HTTP 200, `application/pdf`, `%PDF-`, 814,774 bytes, and five pages. Extracted text had no raw internal IDs, window hash, raw UTC timestamps, or placeholder name. Rendered-page inspection passed.
- Phase 7: Render staging service `srv-dae516lbedkc73bbsc80` is live at deployment `dep-daq8hn0u01pc73f88hp0`, commit `078851b41019e2cc9a1b339048410e447297cc6e`. Independent Swiss recalculation for the supplied Santa Cruz birth data produced Sun 19.59 Pisces, Moon 19.85 Sagittarius, Mercury 12.07 Pisces retrograde, Venus 3.62 Taurus domicile, Mars 0.60 Virgo retrograde, Jupiter 3.46 Virgo retrograde, and Saturn 23.97 Virgo retrograde; the corrected PDF uses that same ledger. The saved timezone is America/Los_Angeles, the UTC period is 2026-09-23T07:00:00Z to 2028-09-01T07:00:00Z (customer-facing through August 31, 2028), and the pack contains exactly 24 months. Additional deterministic fixtures verified Paris/Europe-Paris and Sydney/Australia-Sydney timezone behavior. The supplied failing staging fixture is now rejected by snapshot integrity because its Santa Cruz metadata contradicts its Europe/Paris/Paris ledger. Focused tests (42 tests in the final customer-contract/career-window/callback/PDF run), `npm run typecheck:test`, `npm run build`, and `git diff --check` pass. Four unrelated broader facts-suite reference failures remain documented and are not part of this launch gate.

## Assumptions Ledger

| ID | Assumption | Check |
|----|-----------|-------|
| A1 | Existing Swiss transit evaluator can represent the required career windows. | Phase 2 golden vectors. |
| A2 | Existing major-aspect and orb conventions are reused. | Phase 2 evaluator contract test. |
| A3 | Existing report JSON storage can carry the versioned timing pack. | Phase 1 schema/query audit. |
| A4 | Existing approved-only PDF path can be extended. | Phase 5 real PDF readback. |
| A5 | Existing n8n master and Vocation child workflows can be aligned without replacing unrelated report workflows. | Phase 3 workflow export/diff and smoke. |
| A6 | $39 is the intended launch price. | Pricing single-source test. |
| A7 | Saved birth timezone is authoritative for local month labels. | Phase 2 timezone fixture. |
| A8 | Automated lint and judge thresholds are sufficient for automatic paid completion. | Phase 3 approved-callback test and artifact review. |

## Critique Gate

A blind critique was run and initially failed the draft on human-approval semantics, deterministic timing details, known-time enforcement, callback shape, launch exposure, pricing conflict, legacy-path removal, PDF verification, and executable phase checks (verified: delegation `deleg_819e245f`). Those blockers are addressed in this saved plan through explicit contracts, exact phases, and runnable checks.
