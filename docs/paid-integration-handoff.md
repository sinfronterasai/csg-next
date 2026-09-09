# Paid report integration candidate — not deployed

Branch: integrate/paid-release. Base staging: 8a935adffe4bb3bffa136becf030a4924c947971.
Integrated birth correctness, checksum-pinned ephemeris mounting, privileged paid rework and failure-evidence endpoints, and offline n8n contract patches. Added Next server output tracing for WASM/data and an explicit empty-WASM negative preflight fixture.

## Parent verification
- Focused combined application tests: 68 passed; two opt-in provisioned tests initially skipped.
- Re-ran both opt-in provisioned tests with SWISS_EPHEMERIS_DIR: 2 passed, zero skipped. Real engine and full Free Natal ledger; persistence/auth/outbound dispatch mocked.
- Production and test TypeScript checks passed.
- npm run build passed; local DATABASE_URL absent, so this does not verify live persistence.
- Production dependency audit: zero vulnerabilities. Installation reported one high vulnerability across all dependencies; development dependency audit still needs triage.
- Offline n8n harness: 9 passed, 2 private tests skipped in initial integrated invocation. See subsequent terminal output for retained-fixture rerun.

## Do not deploy blindly
- data/ephemeris is local, ignored, NOT in the remote branch. Three files pass pinned checksums in src/lib/ephemerisData.ts; upstream license is present locally. Verify Swiss Ephemeris licensing entitlement and arrange approved deployment provisioning before release. Trace configuration includes data only if it actually exists during build.
- No live n8n edits or imports made. Apply reviewed Code-node replacements without replacing credential metadata, then verify exact active version and real branch executions.
- Failure reporter endpoint exists but n8n terminal-error reporting wiring is not implemented.
- Rework preserves immutable snapshots; known-invalid report1160 is quarantined. Audited corrected-snapshot recovery is not implemented. Do not bypass the guard or replay known UTC facts.
- Actual paid callback/render/PDF end-to-end validation and visual approval remain outstanding.
- No production tokens, live Stripe configuration, customer rows, or deployment branches changed.

Local worktree: C:/Users/Ethan/csg-paid-integration
Other implementation details: docs/paid-report-rework.md and docs/birth-calculation-integrity.md.
