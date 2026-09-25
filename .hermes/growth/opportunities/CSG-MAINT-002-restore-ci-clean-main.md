# CSG-MAINT-002 — Restore CI-clean main baseline

Status: BLOCKED / RESEARCH

Created: September 25, 2026

## Evidence

Synchronized local `main` with `origin/main` at:

`fd41f1ad35764a9c5889ba7af8685e1851e9539a`

The working tree is clean and local `main` matches `origin/main`.

However, the synchronized `main` branch does not contain the Gate-10 verification infrastructure:

- `.github/workflows/` — absent
- `scripts/ci-test-db.sql` — absent

The Gate-10 reference run was:

`36070082165`

Reference result:

- 146 suites passed
- 3 suites skipped
- 1,083 tests passed
- 4 tests skipped
- production build passed

The current synchronized `main` therefore cannot yet be treated as the approved CI-clean baseline.

## Problem

The production branch is behind the verified Gate-10 CI state. The branch must be reconciled independently before any growth implementation is resurrected.

Do not repair this inside R-016.

## Scope

Restore or re-establish the canonical CI and local verification path on `main`, including the PostgreSQL test bootstrap, migration behavior, deterministic timezone configuration, and all fixes required for a zero-failure full suite.

## Acceptance criteria

- [ ] The canonical CI workflow exists on the production branch.
- [ ] The canonical PostgreSQL/bootstrap configuration exists on the production branch.
- [ ] Local verification reproduces the CI environment rather than using an ad hoc database setup.
- [ ] `npm run typecheck:test` passes.
- [ ] Full test suite passes with zero failures.
- [ ] Production build passes.
- [ ] `git diff --check` passes.
- [ ] The successful CI run is recorded with its commit SHA and run ID.
- [ ] Main is clean and synchronized with `origin/main` after the repair.
- [ ] R-016 remains unchanged and frozen.
- [ ] No n8n changes are included.

## Required evidence

Record:

- repaired base commit SHA
- CI run URL or run ID
- exact suite/test counts
- typecheck result
- build result
- `git diff --check` result
- confirmation that R-016 was not modified

## Out of scope

- Applying the preserved R-016 patch.
- Creating an R-016 v2 branch.
- Resolving the horoscope route collision; that remains CSG-MAINT-001.
- Production deployment.
