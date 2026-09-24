# R-016 — Exact Personalized Transit Window — Final Review Candidate

Status: RESEARCH

Opportunity: Add one named-transit result module to the existing transit route for “when is Saturn square my Moon.” This is a contained product experiment, not a new SEO cluster.

Evidence: dated SERP review on 2026-09-24 captured Transits.io and Ascendant Chart as generic transit-chart competitors. Their visible value is broad lookup; CSG’s proposed gap is transparent exact windows, repeated passes, known-time limitations, and deterministic facts. Search volume and CSG ranking are UNKNOWN and are not used as proof.

Deterministic contract:
- UTC is the calculation authority; input IANA timezone is converted once and stored in the request snapshot.
- Supported input requires a validated known birth date, place, and time; unknown-time requests fail closed for time-sensitive windows.
- Aspect/orb policy is versioned and explicit; exact-hit and applying/separating windows are distinct fields.
- Ephemeris/library version, precision, and calculation contract version are stored with every result.
- DST boundaries, timezone boundaries, repeated/retrograde passes, no-hit, invalid, and non-finite cases are explicit fixtures.
- An independent fixture corpus must match the canonical engine before treatment traffic.

Cheapest pre-launch gate:
1. Run contract/fixture/mutation tests.
2. Shadow-compute treatment output against the existing route without displaying it.
3. Complete a 7-day instrumentation dry run and reconcile server/client events.
4. Proceed only if event completeness is >=98%, duplicate-event rate <=1%, no fixture mismatch exists, and no astronomical fact discrepancy is found.

Experiment:
- 50/50 persistent user-level assignment among eligible named-transit starts.
- Fixed 30-day treatment window after the 7-day instrumentation gate.
- Primary numerator: users with a valid completed named-transit result.
- Primary denominator: eligible users assigned to each arm who started the named-transit flow.
- Primary success: absolute completion-rate lift >=10 percentage points and 95% confidence interval lower bound above 0, with at least 200 eligible starts per arm.
- Operational kill: error rate rises >=1 absolute percentage point.
- Safety kill: any confirmed astronomical fact/data-integrity error.
- Inconclusive: fewer than 200 starts per arm or instrumentation completeness <98%.
- No-go: sufficient sample with the predeclared confidence bound failing the lift target.

Conversion: account/save only. Yearly Transit Forecast CTA is disabled unless a named production-readiness check verifies route, checkout, entitlement, delivery, support/refund path, and analytics readback.

Scope: one feature-flagged component, versioned data contract, fixture corpus, events, analysis script, and CTA guard. No generated page cluster.
