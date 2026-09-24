# Vocation & Wealth Map implementation note

Date: September 23, 2026

Scope: Vocation & Wealth Map only.

Completed contracts:

- `vocation` is launch-enabled and priced at $39.
- Known birth time and saved timezone are required before VerifiedFacts construction, reading creation, purchase consumption, dispatch, or generation.
- `csg-vocation-career-windows-v1` emits exactly 24 calendar-month buckets beginning in the saved birth timezone, with deterministic UTC boundaries, stable IDs, movers, targets, aspects, directions, retrograde state, exact hits, local labels, evidence IDs, scores, and canonical ordering/hash.
- The pack now freezes a birth snapshot containing the date, time, location, coordinates, and IANA timezone. Callback and PDF delivery reject contradictions between that snapshot and saved customer metadata.
- Timing targets are limited to MC, the 2nd-house ruler, the 10th-house ruler, Saturn, and Jupiter.
- `careerWindowsDeclared` is true only after pack validation, provenance validation, and ledger fact resolution.
- The application callback accepts approved/rejected callbacks with exact block-based section contracts, validates evidence IDs and birth snapshots, sanitizes known internal identifiers for customer prose, and rejects malformed, unsupported, or unsafe output.
- Approved reports expose the same deterministic coverage, featured periods, and complete chronological appendix in the web UI and PDF.
- A dedicated Vocation PDF renderer embeds DejaVu Sans, uses the approved sections and deterministic pack, renders human-readable dates/transits, adds a prioritized 30/60/90-day action plan, and omits hashes, raw UTC timestamps, and internal IDs.

Verification artifacts:

- `tests/reports/vocation-customer-contract.test.ts`: 4 passing contract tests.
- Final focused customer-contract/career-window/callback/PDF gate: 4 suites, 42 tests passing.
- n8n child fixture execution 296: approved callback shape verified.
- n8n child fixture execution 295: rejected callback with rejection reasons verified.
- Independent Swiss recalculation for Santa Cruz, California (`1980-03-09 16:21`) produced Sun 19.59 Pisces, Moon 19.85 Sagittarius, Mercury 12.07 Pisces retrograde, Venus 3.62 Taurus domicile, Mars 0.60 Virgo retrograde, Jupiter 3.46 Virgo retrograde, and Saturn 23.97 Virgo retrograde.
- Corrected local artifact `vocation-wealth-map-corrected.pdf`: embedded-font PDF, 5 rendered pages, no raw IDs/hash/UTC timestamps/placeholders; visual inspection passed.
- `npm run typecheck:test`, `npm run build`, and `git diff --check`: passing.

External staging gate:

- Render staging service `srv-dae516lbedkc73bbsc80` is live at commit `078851b41019e2cc9a1b339048410e447297cc6e`, deployment `dep-daq8hn0u01pc73f88hp0`.
- Real staging n8n smoke execution 310 completed through the master router and Vocation child with corrected Santa Cruz facts. Disposable reading 1280 and report correlation `0bf34ad0-ef00-441c-824d-e9b991b89098` persisted `approved` with nine sections.
- Authenticated staging `/api/profile/reports` returned the approved `vocation` report with its deterministic presentation.
- Authenticated staging `/api/reports/1280/pdf` returned HTTP 200, `application/pdf`, `%PDF-`, 814,774 bytes, and five pages. Extracted text contained the corrected America/Los_Angeles coverage through August 31, 2028, action plan, featured periods, complete appendix, and disclaimer; no raw IDs, hashes, timestamps, or placeholder name were present. Rendered-page inspection passed.
- The supplied failing fixture is now correctly blocked by deterministic snapshot integrity: Santa Cruz metadata cannot be delivered with a Europe/Paris/Paris ledger.
- Additional deterministic fixtures verified Europe/Paris and Australia/Sydney timezone handling. The quietest available known-time fixture still produced 10 qualifying windows; the 24-month empty-window path remains covered by the deterministic renderer fallback.
- Four broader facts-suite failures remain outside this Vocation launch change: dense-vs-sparse aspect count and stale Juno/Chiron retrograde reference expectations.
