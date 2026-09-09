# Premium Natal repair-contract candidate — OFFLINE ONLY

Source: read-only SQLite/SSH export of workflow `041aea81bd395e74`, active/draft both `e2c11b21-272b-4181-9e1a-cffc8831367e`. Router token supplied as `router5aa8605ae98c5735` was not a database ID; discovery identified the named Master Router as `5aa8605ae98c5735`, active/draft `ec011522-78d6-4903-9863-5bcb854270d6`. No router modifications.

## Review surface

- `baseline/`: actual exported Code nodes, no credentials or customer fixtures.
- `build.cjs`: narrow patches and shared prompt/schema compilation.
- `judge-contract.cjs`: `csg.judge.v1`, strict full JSON, exact supported section/fact IDs, complete gates/scores, conservative flags/safety exclusion, canonical `specificity` with explicit legacy `specific` input alias. Initial and rejudge use identical validator. Paid pass still requires every score >=4; rejudge cannot initiate another repair.
- `nodes/`: compiled standalone n8n Code-node replacements.
- `contract.test.cjs`: deterministic actual-Code-node harness. Only n8n item/reference access is emulated; no models, generation, network, or business approvals.
- `package.cjs`: version-pinned private snapshot -> private candidate; validates baseline and compiles every Code node. Asserts unchanged connections, settings, and attempt-cap node.

## Fixes and limits

Execution219 retained lint #2 contains only uncited footer specificity findings. The current deployed prompt selects that footer but supplies `{}`. The candidate selects up to twelve **named-body placement relationships** from the existing verified ledger when citations are absent. These are rewrite options, NOT validation of the existing footer's aspects/stellium/house prose. Unsupported relationships must be deleted/replaced; merging requires exact IDs from the offered pack. Existing cited packs (including the larger planet table) are retained, not arbitrarily capped. No fallback to full ledger and no guessed aspect relationships.

Removed unsafe prose-existence citation regex in all three normalizers. Conservative backfill is allowed only when the *entire block* exactly equals one unambiguous authoritative ledger display, with matching ID. Decimal, wrong-sign/degree/house and compound prose never get IDs merely because a body is present. This intentionally does not attempt general natural-language factual entailment; independent judge still must compare actual values/relationships, not IDs alone. Offline tests cannot prove model compliance or report approval.

Existing duplicate pair targeting, untouched-section merge, finite lint attempt condition `<5`, finalizers, workflow wiring and model configuration are unchanged. A no-authority uncited section fails closed rather than fabricating evidence. Existing thrown-error handling for such unrepairable lint input remains a separate lifecycle concern; this change targets the proven footer blocker, not a routing redesign.

## Reproduce

```bash
node offline/natal-repair/build.cjs
node --test offline/natal-repair/contract.test.cjs
# Private optional retained execution fixture; never commit it:
RETAINED219=C:/Users/Ethan/AppData/Local/hermes/profiles/content-manager/workspace/natal-repair/retained219-private.json node --test offline/natal-repair/contract.test.cjs
node offline/natal-repair/package.cjs PRIVATE_SNAPSHOT PRIVATE_CANDIDATE
```

Observed RED failures: empty footer authority; unsafe Part of Fortune auto-citation; incomplete judge accepted for repair; missing version/threshold/roles prompt contract; unsupported replacement IDs accepted; an initial fallback bound incorrectly restricted existing planet-table citations (fixed and regression tested).

Observed GREEN: 11/11 tests including both retained219 cases, zero skipped with private fixture. Full candidate Code-node syntax compilation passed; topology/settings/cap invariant checks passed. No live import, publish, execution, model call, callback, payment, or replay of report1160 was performed. Parent approval and authorized live verification remain mandatory before deployment. Snapshots/candidate stay in the active content-manager private workspace and exclude node credential metadata; do not import the credential-stripped candidate blindly.
