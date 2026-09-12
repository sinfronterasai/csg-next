# Compact report child workflow (private artifact)

This directory is an exportable, standalone n8n child workflow. It is not imported, published, or deployed. The legacy workflow `041aea81bd395e74` is untouched and remains the rollback path.

## Contract

Input is one item containing:

- `verifiedFacts`: complete `csg-report-facts-v2` ledger, retained for deterministic ownership and downstream provenance.
- `deterministic.tables`: code-owned factual tables.
- `deterministic.skeleton`: code-owned section/order/block contract.
- `narrativeFactPacks`: exactly four compact packs with IDs `identity`, `inner-world`, `integration`, and `dynamics`.

The child freezes the deterministic snapshot before any narrative request. The writer endpoint receives only the current pack (`sectionId`, role, word limit, and allowlisted facts). It cannot receive or author tables.

## Topology

`Execute Workflow Trigger → Validate Input + Freeze Deterministic Snapshot → Loop Over Four Compiler Slots → Narrative Slot Call → Strict Validate Narrative Slot → Slot Valid? → Accumulate Validated Slot → Loop`

The loop `done` output reaches `Final Deterministic Quality Gate + Callback`. A failed primary slot takes one targeted request through `Repair Failed Slot Once`; failed repair is terminal. There is no report-wide revision, judge/rejudge loop, planet-table model call, delay, credential, or secret in this artifact.

The primary endpoint is configured by `REPORT_NARRATIVE_ENDPOINT`; targeted repair uses `REPORT_NARRATIVE_REPAIR_ENDPOINT`. Both are placeholders and are not called by the local harness.

## Output

`csg-compact-report-callback-v1` with the exact input `reportId`, `status: approved`, the deterministic `skeleton` and `tables` copied from the frozen input, and exactly four validated narrative blocks in compiler order. AI-supplied table fields are discarded.

## Verification

```sh
node --test contract.test.cjs
```

The harness proves four primary calls, allowlisted IDs, missing-slot rejection before calls, strict unsupported-fact rejection, table immutability, and one targeted repair maximum. It is intentionally network-free and uses no model calls or secrets.

Next app integration seam: add an adapter at the existing report dispatch boundary that sends the current full `verifiedFacts` plus `compilePremiumNatalReport(...).tables/skeleton` and `buildNarrativeFactPacks(...)`, then map this callback payload into the existing app callback validator. Do that as a separate compatibility change after this private child has been imported and exercised in a non-live n8n environment.
