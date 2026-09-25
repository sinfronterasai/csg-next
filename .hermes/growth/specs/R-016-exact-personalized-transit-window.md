# CSG Growth Specification

ID: R-016

Status: BUILDING

## Opportunity

Add one fact-first named-transit result module to the existing transit route for “when is Saturn square my Moon?” intent. This is a contained experiment, not a new SEO page cluster.

## User intent

A visitor wants to know whether a named transit is active, the exact hit/window dates, repeated passes, and the limits of the result for their birth-time quality.

## Evidence

SERP review captured September 24, 2026 identified Transits.io and Ascendant Chart as generic transit-chart competitors. Search volume and CSG ranking are UNKNOWN. CSG repository capabilities include deterministic ephemeris, natal chart, transit, yearly-transit, and known-time policy code.

## Existing SERP competitors

- Transits.io
- Ascendant Chart

## Why CSG can realistically compete

CSG can reuse an existing deterministic transit surface and expose transparent exact windows, repeated passes, known-time limitations, and versioned facts instead of generating generic transit prose or a page farm.

## CSG differentiator

A verified, fail-closed named-transit window with explicit UTC/IANA handling, aspect/orb policy, repeated-pass ordering, precision metadata, and no invented astronomy.

## Acquisition channel

SEO: Named-transit queries through the existing transit surface; no mass-generated cluster.
Social: Not a primary channel for this experiment.
Referral: Not a primary channel for this experiment.
Direct: Existing chart/transit users.

## Product experience

1. Visitor enters or arrives with valid birth data.
2. The route evaluates Saturn square natal Moon under the supported known-time policy.
3. The result displays valid exact hits/windows, applying/separating state where supported, and data-quality limitations.
4. Invalid, unknown-time, no-hit, non-finite, or unsupported cases fail closed with a useful explanation.
5. Visitor may save/account only; no unverified paid CTA appears.

## URLs

Existing transit route: repository route to be identified during implementation.
Treatment is feature-flagged on the existing route. No new indexable URLs in this experiment.

## Data requirements

- Validated birth date, time, place, and IANA timezone.
- Canonical natal snapshot.
- Transit calculation request and response IDs.
- Ephemeris/library version.
- Aspect/orb policy version.
- Feature assignment and event idempotency key.

## Deterministic calculations

- UTC is the calculation authority.
- IANA timezone conversion occurs once and is stored in the request snapshot.
- Known-time requirements are enforced and unknown-time windows fail closed.
- Aspect bodies/targets, geometry, orb inclusion, precision, rounding, pass deduplication/order, and serialization IDs must be versioned.
- Fixture corpus must cover exact hits, no-hit, repeated/retrograde passes, DST/timezone boundaries, invalid inputs, and non-finite responses.
- Fixture provenance must include external/reference expected values or independently authored expected outputs.

## AI-generated components

None for astronomical facts. Any future interpretation must be clearly separated from verified calculation output and cannot alter dates, aspects, or windows.

## UI requirements

- Clearly label exact facts versus explanatory copy.
- Show calculation/version and known-time limitations where relevant.
- Handle loading, invalid, no-hit, unknown-time, and error states.
- Feature flag treatment.
- Accessibility and mobile behavior must match the existing route.

## SEO requirements

Title pattern:
Existing transit title plus named-transit intent; do not create a new indexable page in this experiment.

Meta pattern:
Accurate named-transit result description without unsupported promises.

Schema:
Use only existing route-appropriate schema; no fabricated event schema.

Canonical behavior:
Existing route canonical.

Indexing behavior:
No new indexable treatment URLs.

Hub page:
None for this experiment.

Internal links:
Existing transit/chart navigation only.

## Conversion path

Entry page
→ named-transit interaction
→ verified result
→ account/save
→ verified paid product only after a separate production-readiness gate

## Distribution assets

None required for the first experiment.

## Analytics events

Versioned server/client events:
- `named_transit_eligible`
- `named_transit_assigned`
- `named_transit_started`
- `named_transit_completed`
- `named_transit_error`
- `named_transit_account_save_started`

Events require experiment ID, assignment arm, route, calculation contract version, idempotency key, and timestamp. Server/client reconciliation target: ≥98% completeness and ≤1% duplicates before treatment.

## Acceptance criteria

- [ ] Deterministic contract and independent fixture corpus pass.
- [ ] Shadow comparison against the existing route passes with zero astronomical discrepancy.
- [ ] Unknown-time, invalid, no-hit, repeated-pass, DST, timezone, and non-finite cases fail or render according to contract.
- [ ] Treatment assignment is persistent at user level and fail-closed when assignment is unavailable.
- [ ] Paid CTA is absent unless the named production-readiness predicate passes.
- [ ] Event completeness is ≥98% and duplicate rate ≤1% during the instrumentation gate.

## Tests required

- [ ] Unit, contract, mutation, fixture, timezone/DST, and serialization tests.
- [ ] Integration/browser tests for route states, assignment, event reconciliation, and CTA guard.
- [ ] Analysis script test with frozen numerator/denominator and confidence-bound method.

## Pre-build validation experiment

Hypothesis:
A transparent named-transit window increases completion or account/save behavior versus the existing generic transit surface.

Cheapest test:
Contract tests, shadow computation, instrumentation dry run, then a persistent 50/50 treatment/control test on one existing route and one named aspect.

Baseline:
Seven-day instrumentation baseline for eligible starts, completions, errors, and account/save events.

Target:
At least 200 eligible starts per arm; absolute completion-rate lift ≥10 percentage points; 95% confidence-interval lower bound ≥0; no error-rate regression ≥1 absolute point.

Success threshold:
All target conditions met with fixed analysis date and no safety issue.

Kill threshold:
Any confirmed astronomical/data-integrity error; error regression ≥1 point; or confidence-interval upper bound below the declared lift after minimum sample.

## Rollout

Initial cohort:
One named aspect, Saturn square natal Moon, existing transit route, feature flag, persistent 50/50 assignment after validation gates.

## Success criteria

Primary: completed named-transit result / eligible named-transit starts.
Secondary: account/save starts, error rate, event completeness.

## Expansion criteria

Only after the fixed analysis passes and human approval: add one additional named aspect with a new fixture set and repeat the same gates.

## Kill criteria

Safety kill, operational error kill, inconclusive low-sample state, or no-go after sufficient sample as defined above.

## Risks

Ephemeris/timezone errors, unknown-time misuse, repeated-pass ambiguity, event drift, false-positive statistical interpretation, and unverified paid destination exposure.

## Out of scope

Mass programmatic pages, broad transit clusters, AI-generated astronomical facts, paid CTA exposure before readiness verification, production deployment, and n8n changes.
