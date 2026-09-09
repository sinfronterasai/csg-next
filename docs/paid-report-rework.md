# Privileged paid report rework

## Authorization and request

`POST /api/reports/[readingId]/rework` uses the existing editor-decision convention:
`auth_token` session cookie, verified token, then **current database** user role
`editor` or `admin`. The token's role is not trusted. Customers cannot invoke it.
A same-origin `Origin` header is required (also for operator HTTP clients).

JSON body, maximum 2 KiB:

```json
{
  "expectedReportId": "current-app-generated-UUID",
  "reason": "Brief non-sensitive explanation of the repair"
}
```

Use the actual current correlation UUID; the illustrative string above is not a
valid request. No owner, purchase, chart, facts, tier, or failure-evidence overrides
are accepted. There is no browser bearer, new shared secret, or billing call.

The transaction locks the consumed order and then its reading. It checks exactly
one order, same owner, report type and SKU, paid launch availability, positive
paid amount, recorded Stripe session/payment, and matching current correlation.
It accepts rejected/dispatch_failed, or queued/processing with recorded terminal
execution failure evidence. Approved and needs_editor are always protected.

The original reading card, owner, payment and snapshot remain unchanged. A new
correlation and queued pipeline replace the current attempt; callback hash is
reset to NULL. `result.reworkHistory` appends prior result/status/hash plus actor,
reason and request time. Earlier history entries are carried forward unchanged
(without recursively copying the entire history). Order correlation changes in
the same transaction, but its consumed status, amount, and Stripe IDs do not.
The new attempt dispatches only the snapshot returned by the locked claim.

409 means a stale correlation/state, missing snapshot, or another claim won.
402 means entitlement validation failed. No dispatch occurs for either outcome.
Do not respond by creating another checkout.

## Terminal failure evidence

`POST /api/reports/pipeline-failed` is **server-to-server only**, authenticated
with the existing `REPORT_CALLBACK_TOKEN` exactly like pipeline-complete.
Never put that bearer in browser tools, UI code, screenshots, or support notes.

The trusted n8n failure reporter (or a server-side operator inspecting a terminal
execution) must submit the actual app correlation and execution evidence:

- `reportId`: current app-generated UUID
- `executionId`: positive decimal execution ID, at most 20 digits
- `failedNode`: nonblank node label, at most 120 characters
- `failedAt`: actual UTC failure time in `YYYY-MM-DDTHH:mm:ss.sssZ` form
- `status`: exactly `failed`

Only these keys are accepted, with a maximum 2 KiB body. No stack, prompt, report
text, arbitrary URL, or birth data belongs here. Failure time must be within the
last seven days, no later than database time, and no earlier than this attempt's
start. Legacy rows fall back to the latest retry timestamp or original creation.
Identical evidence is idempotent; conflicting evidence cannot overwrite it.
Only current queued/processing attempts accept evidence. Old correlations and
approved/rejected/review states cannot be marked failed.

Recording evidence does not change pipeline_status and does not dispatch. A
separate privileged rework request consumes this recovery eligibility. This
prevents accidentally opening the existing customer dispatch_failed retry path.
Elapsed queue time alone is **never** treated as failure. No timer sweep exists.

## Limits and rollout gates

- No remote workflow, deployment, customer row, or token was changed by this patch.
- n8n error-workflow wiring is NOT included. Configure a trusted terminal-execution
  reporter separately and verify its correlation propagation before rollout.
  The endpoint trusts that authenticated reporter's attestation; it does not
  independently call the n8n API or accept browser-provided execution claims.
- Existing queued reading 1160 was NOT recovered. Its correlation
  `6deeb156-4f6d-40e2-988d-a714ff966c39` is quarantined by the claim with
  `invalid_snapshot` (409) because its stored UTC facts are known wrong. Failure
  evidence does not authorize replaying invalid facts. Do not change its ID or
  remove this guard to force a retry.
- Fact rebuild/admin correction is NOT implemented. Before recovering 1160 (or
  any other report with suspected invalid facts), verify original civil birth
  inputs, timezone and historical offset using the corrected deterministic chart
  path. An audited correction must retain the old snapshot in attempt history,
  persist a separate versioned replacement with provenance and privileged review,
  and atomically bind that replacement to a new attempt without charging again.
  This endpoint intentionally accepts no snapshot overrides; do not edit the old
  immutable metadata in place. The chart fix alone does not repair stored facts.
- For otherwise valid snapshots, inspect the actual failed execution and its
  timestamp/correlation before submitting evidence; never invent a fresh
  timestamp for an old failure.
- A crash after claim, or an ambiguous dispatch timeout/5xx, stays queued. The
  response reports dispatch unconfirmed. Neither age nor an HTTP error proves
  that n8n did not accept the job. Absent terminal execution evidence, automatic
  recovery is intentionally blocked. An outbox/receiver-dedup rollout would be
  needed to recover that uncertainty safely.
- One local claim winner is tested, not downstream exactly-once execution. No
  remote receiver deduplication or live Stripe/n8n end-to-end run was performed.
- Legacy customer `claimRetry` is unchanged. It can leave order and reading
  correlations inconsistent; this new privileged action fails closed on those
  rows rather than silently repairing purchase history.
- History is append-only through this application path, not a database-level
  tamper-proof audit ledger. Existing public report serializers allowlist fields
  and do not expose history or failure evidence.

## Local verification

No migration is required. Added PGlite is dev-only; Jest's VM modules flag loads
its WASM dependencies. The regular suite runs in-memory SQL tests without a DB.

```bash
npm test -- --runInBand tests/reports/paid-rework-store.test.ts tests/reports/paid-rework-route.test.ts tests/reports/pipeline-failed-route.test.ts
npx tsc --noEmit --incremental false
npm run typecheck:test
DATABASE_URL= npm run build
```

For actual independent PostgreSQL connections and row-lock races, start a fresh
**disposable local** container (the suite never reads DATABASE_URL):

```bash
docker run --name csg-paid-rework-test --rm -d -p 127.0.0.1:55439:5432 -e POSTGRES_PASSWORD=local-rework-test -e POSTGRES_DB=rework_test postgres:16-alpine
docker exec csg-paid-rework-test pg_isready -U postgres -d rework_test
CSG_REWORK_LOCAL_PG=1 npm test -- --runInBand tests/reports/paid-rework-store.test.ts
docker stop csg-paid-rework-test
```

The credentials above are disposable test fixture values, not deployed secrets.
The SQL fixture intentionally requires a fresh database (CREATE fails if tables
already exist), so restart the disposable container before another live run.

Full-suite baseline has failures in six existing suites: LB public resume and
regression, ReportsView status, SharedReportPage, tarot store, tarot reflection.
The same 20 failures reproduce on the untouched staging source worktree.
They concern stale UI expectations/mocks and unavailable local tarot DB fixtures,
not this change. The resumed implementation run returned 106 passing suites,
6 failing suites, 1 skipped suite; 830 passing tests, 20 failing tests, 2 skipped.
The focused route/correlation/customer-retry/callback run passed 75 tests; the
real disposable PostgreSQL store run passed all 30 tests, including concurrent
claims, callback/rework races, rollback and the known-invalid snapshot quarantine.
Production build, production/test typechecks and diff whitespace checks passed.
The quarantine regression was observed failing before the guard was added.
Static added-line security scan found only explicit disposable test credentials.
Independent reviewer CLI was unavailable in the interrupted run; parent-agent
review remains required before integration. No independent-review approval is
claimed by this commit.
