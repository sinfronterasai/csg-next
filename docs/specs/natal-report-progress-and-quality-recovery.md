# Natal Report: progress UX and quality-recovery contract

Owner: Pike (implementation)
Editorial owner: John
Priority: P0 - current customer flow is misleading after a valid quality rejection.

## Verified production evidence

- Master Router execution `86` and Natal Writer/Judge execution `87` both show `success` because n8n executed and delivered the callback successfully.
- The callback explicitly carried `status: "rejected"`; the app accepted it and returned `{ success: true, status: "rejected" }`.
- The customer-visible quality-bar message is therefore expected behavior for this run, not a missing-report rendering defect.
- The report was correctly rejected because the judge found a factual hallucination: prose claimed `Uranus-Pluto sextile (orb 0.20°)` that was not in the supplied verified-facts ledger.

Do not render rejected prose to customers and do not silently mark it approved. Facts are evidence and must remain fail-closed.

## Product behavior to implement

### 1. A single live report-generation experience

When a customer starts an async report from `/reports`, immediately create/show one report card on that same page. Do not redirect them to a disconnected experience.

States:

1. `queued` - "Your chart is in the constellation room. Preparing your verified facts."
2. `generating` - "Writing your personalized interpretation." Show a determinate-looking staged progress bar (not fake percentage claims) and a current-step label.
3. `checking` - "Checking every claim against your chart." 
4. `needs_editor` - "Your report passed automated checks and is in final review."
5. `approved` - replace the progress card in place with the complete readable report and PDF action.
6. `rejected` - do not call it a completed report. Show the existing quality-protection message plus a retry action. This state must preserve the record and stay auditable.

Poll the existing authenticated report endpoint while the page is open. Stop polling only for terminal states (`approved`, `needs_editor`, `rejected`) or an unrecoverable fetch error. On `approved`, refetch/render the canonical callback-saved sections in the same page without requiring a manual refresh.

### 2. Retry must be bounded and recoverable

`Retry Report` must create a new, correlated attempt (or explicitly reset the existing row only if idempotency and audit history are preserved), then return the customer to the same report card in `queued` state.

A quality rejection should trigger at most one automated repair attempt before terminal rejection/appropriate human-editor escalation. Never loop indefinitely and never deliver a report that failed factual fidelity.

### 3. Close the factual-revision gap in n8n

The existing natal child only revises after deterministic lint failure. Execution 87 proves the judge can find a factual error after deterministic lint passes. Route judge verdict `reject` caused by factual-fidelity failure to ONE bounded revision pass using the exact judge feedback, then judge it again. If it still fails, callback `rejected`; for paid reports use the required editor escalation path.

The revision prompt must require that every prose claim correspond to a `factsCited` ID in the provided ledger and must not permit a placement/aspect merely because it sounds plausible.

## Acceptance evidence

Automated regression tests (test-first):

1. A callback with `approved` stores sections and changes a currently visible `/reports` card from progress state to rendered report without reload.
2. A report dispatched from `/reports` displays an accessible progress indicator and staged status text while polling a queued/generating record.
3. Polling stops on each terminal status; it does not continue after `approved`, `needs_editor`, or `rejected`.
4. A rejected callback never renders report prose and offers retry.
5. Retry creates/retains auditable correlation and returns the same UI card to queued progress state.
6. Natal n8n test fixture: first judge factual reject -> exactly one revision -> re-judge; a second factual reject remains rejected. Assert no `approved` callback for either failed factual case.
7. Existing callback-security and status-regression tests remain green.

Manual/live verification:

- Start one test natal report, capture the report ID, observe the staged card on `/reports`, and verify the exact callback status in n8n execution data.
- For a successful fixture, verify the complete sections appear in that same card when the callback arrives.
- For a factual-rejection fixture, verify no prose is exposed and retry works without duplicate dispatch.
