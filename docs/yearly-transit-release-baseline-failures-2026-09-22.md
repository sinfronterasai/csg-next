# Yearly Transit Release — Baseline Failures

Date recorded: September 22, 2026
Project: `csg-next`
Branch: `feature/yearly-transit-staging`

## Verification context

Command run:

```text
npm test -- --runInBand
```

Result:

- 143 total suites
- 136 passed
- 7 failed
- 3 skipped
- 1,052 tests passed
- 16 tests failed
- 4 tests skipped

Production build passed with `npm run build`.
Yearly Transit focused verification passed separately:

- 11 suites passed
- 40 tests passed
- TypeScript check passed
- `git diff --check` passed

These failures are recorded as baseline/non-Yearly-Transit release debt. They are not being treated as blockers for the Yearly Transit feature unless a future change touches the affected areas.

## Failed suites

### 1. `tests/reports/factsV2.test.ts`

Failures:

- Dense reference fixture produced 83 aspects instead of the test's expected value greater than 85.
- Known-time retrograde reference included `juno` unexpectedly.
- Retro/null-dignity fixture included `chiron` unexpectedly in the retrograde set.

Likely area: legacy chart/facts fixture expectations versus current Swiss ephemeris output or body inclusion policy.

### 2. `tests/reports/birth-snapshot.test.ts`

Failures:

- Save request returned HTTP 500 where the test expected HTTP 200.
- Coordinate/timezone preservation case also returned HTTP 500.

Likely area: test environment/database or birth-snapshot route setup. The current shell had no `DATABASE_URL` configured.

### 3. `tests/reports/factsV2-independent-ephemeris.test.ts`

Failure:

- Independent ephemeris retrograde set included `juno` unexpectedly.

Likely area: legacy body allowlist/reference expectations.

### 4. `tests/lb-public/lb-public-resume.test.ts`

Failure:

- Non-Love-Blueprint purchase returned HTTP 402 while the test expected HTTP 403.

Likely area: status-code contract drift in the LB-PUBLIC resume route.

### 5. `tests/reports/SharedReportPage.test.tsx`

Failures:

- Shared report page failed because `toPublicReport` was not exported/available from the mocked report store module.
- The stale-token test hit the same missing function before it could assert the expected not-found behavior.

Likely area: test mock/export mismatch or a missing public export in the report store.

### 6. `tests/tarot/store.test.ts`

Failures:

- All four store tests failed with `Database connection unavailable`.

Likely area: database-dependent tests were run without `DATABASE_URL` and a reachable test database.

### 7. `tests/tarot/reflection.test.ts`

Failures:

- All three reflection tests failed with `Database connection unavailable`.

Likely area: database-dependent tests were run without `DATABASE_URL` and a reachable test database.

## Follow-up plan

Review these seven suites next week. Prioritize in this order:

1. `SharedReportPage.test.tsx` — likely small export/mock correction.
2. `lb-public-resume.test.ts` — confirm intended 402 versus 403 contract.
3. `birth-snapshot.test.ts` — rerun with test database configuration.
4. Tarot store/reflection suites — rerun with database configuration before changing code.
5. Facts V2 suites — reconcile body allowlist and ephemeris fixture expectations.

## Release disposition

Yearly Transit focused gates are green. The production build is green. These seven unrelated baseline suites remain scheduled technical debt and should not be silently counted as Yearly Transit failures.
