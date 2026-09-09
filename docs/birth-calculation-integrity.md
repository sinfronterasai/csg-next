# Birth calculation integrity handoff

## Scope and evidence

Base: origin/release/p0-lb-staging-20260905 (8a935ad).
No live DB, credentials, paid APIs, n8n executions, or deployments were accessed.
Execution 219 is caller-provided evidence, not independently inspected here.

The base already contained Santa Cruz aliases and timezone recovery. Remaining
source defects were coordinate-string geocoding defaulting to UTC, mixing client
coordinates with an unrelated place-name timezone, permissive coordinate coercion,
dropping saved coordinates at the report/ephemeris boundary, and mutating only a
legacy chart's timezone without rebuilding its stored positions.

POST /api/birth-chart now derives the zone at validated explicit coordinates (or
uses forward geocoding when coordinates are absent). Report generation resolves
one anchor, passes it into the facts builder and computation, and persists that
same anchor in metadata.birthData for dispatch. Existing chart rows/readings are
not relabeled. Complete calculation anchors do not re-geocode the display label.

The offline Swiss WASM fixture 1980-03-09 16:21, 36.97412,-122.0308 uses
America/Los_Angeles, UTC 1980-03-10 00:21, and ascendant longitude
148.180952241537 (Leo). This is an actual computation, not a full independent
astrological audit.

## Ephemeris blocker — release must account for this

Installed Swiss WASM returns returnCode=-1 and six zeroes for Chiron/Juno because
seas_18.se1 is absent. The old engine emitted fabricated Aries placements and the
ledger labeled them swiss-ephemeris. Successful core planets use Swiss's Moshier
fallback (returnCode=260); that is not a failed calculation.

The engine now omits failed optional asteroid placements from free chart output,
keeping core planets/houses usable. Real zero longitude is accepted when the
engine succeeded. VerifiedFacts requires all bodies and returns input_incomplete
before purchase consumption or dispatch if required calculations are unavailable.

IMPORTANT: This means both paid reports and the shared free *report-generation*
ledger fail closed in this environment until asteroid data is provisioned. Free
chart calculation/saving remains available; mocked free-report dispatch regression
tests pass but do not establish real full-ledger availability. This change does
not provision ephemeris files or weaken the factual contract to fake completeness.
Existing broad report tests expecting fabricated zero asteroids need valid offline
ephemeris fixtures; do not restore the sentinel behavior to satisfy them.

Remaining: provision and verify licensed/appropriate asteroid ephemeris data in
WASM's filesystem, then run a real complete paid/free ledger smoke before release.
Old immutable reports/retries remain unchanged and require an explicit remediation
policy. Coordinate lookup is approximate near timezone boundaries; forward place
geocoding can still be ambiguous. Historical DST gaps/folds are not addressed here.

## Verification

RED was observed for coordinate->UTC, missing report coordinates, invalid explicit
coordinate persistence, wrong named-city timezone, ephemeris sentinel acceptance,
immutable-anchor network re-geocoding, and recovered snapshot coordinates.

Focused run: 10 suites, 48 tests passed (offline/mocked boundaries).
Includes chart_birth_correctness, chart_ephemeris_validity, chart_google,
birth-snapshot, birth-engine-boundary, free-dispatch, generate-entitlement,
retry-route, generate-repeat-fastpath, and profile/birthChartSave.
Both `tsc --noEmit` and `tsc -p tsconfig.test.json` passed. `git diff --check` passed.
Existing ts-jest deprecation warning and intentional retry-error console output
remain. node_modules is a local junction to the source worktree's installed deps;
no dependency or secret files were copied/changed.
