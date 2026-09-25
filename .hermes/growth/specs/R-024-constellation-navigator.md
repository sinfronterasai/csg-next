# CSG Growth Specification

ID: R-024

Status: READY

## Opportunity

Promote CSG’s existing constellation navigator to completed-chart users as a visual continuation and safe share surface. Search demand is UNKNOWN; this is a product-led/social experiment.

## User intent

A completed-chart user wants to see a visual constellation relationship and optionally share a safe representation without exposing birth inputs.

## Evidence

Repository evidence:
- `src/app/constellations/`
- `src/app/api/constellations/natal/route.ts`
- `src/lib/constellations/`
- Existing constellation tests

Alternatives include standard chart wheels and shareable birth-chart visuals. CSG’s differentiator is a deterministic constellation visualization tied to the verified natal result. Search demand is intentionally not assumed.

## Existing SERP competitors

No new SEO cluster is approved. Standard chart wheels and shareable birth-chart visuals are the alternative class; exact search demand is UNKNOWN.

## Why CSG can realistically compete

The navigator already exists and can be promoted to current chart users. The first gate is an invite-only fake-door/canary, not public SEO acquisition.

## CSG differentiator

Verified natal inputs feed a deterministic constellation visualization with safe, allowlisted sharing and no unsupported celestial claims.

## Acquisition channel

SEO: None for initial rollout; no new indexable cluster.
Social: User-initiated visual sharing.
Referral: Safe share URL returns.
Direct: Existing completed-chart users.

## Product experience

1. Authenticated user completes a chart.
2. Eligible canary/treatment user sees an explanatory navigator entry.
3. User opens the existing navigator and reaches a defined end-state control.
4. User may explicitly create a safe share artifact.
5. External visitor sees only allowlisted constellation/result fields.
6. Return/account behavior is measured; no paid CTA appears until destination readiness is verified.

## URLs

Existing constellation/natal route plus a controlled share readback route. Exact path is locked in the implementation PR. Share route is excluded from sitemap/canonical/OG/listing.

## Data requirements

Allowlisted constellation/result payload only. Exclude birth date/time/place, coordinates, account identifiers, hidden metadata, and unsupported claims.

Share storage: 256-bit random token stored hashed; active retention 90 days; automatic expiry; 30-day tombstone hash after revocation/deletion.

## Deterministic calculations

Use the existing verified natal constellation/coordinate contract. No new astronomical calculation or claim is introduced. Share serializer fails closed on unknown, extra, or unallowlisted fields.

## AI-generated components

None for constellation facts. No AI-generated astronomical claims.

## UI requirements

- Explanatory entry module.
- Explicit share confirmation showing the safe fields.
- Existing navigator remains keyboard and screen-reader usable.
- Loading/error/no-result/revoked/expired/missing states.
- Mobile performance budget.
- No hidden birth data in payloads, previews, or analytics.

## SEO requirements

Title pattern:
CSG Constellation Navigator — shared visual result

Meta pattern:
Factual, non-identifying description of the constellation result.

Schema:
No public structured data exposing personal chart details.

Canonical behavior:
No canonical URL for share objects.

Indexing behavior:
`noindex,nofollow`; no sitemap, canonical, OG, or public listing; no-referrer.

Hub page:
None.

Internal links:
Controlled return to the CSG chart/navigator experience only.

## Conversion path

Entry page
→ completed chart
→ navigator interaction
→ safe share/return
→ account
→ verified relevant product

Paid CTA remains disabled until the owner-approved route/checkout/entitlement/delivery/support readiness predicate passes.

## Distribution assets

One safe visual share format and one opaque share URL. No automated or manipulative distribution.

## Analytics events

Schema v1 fields: eventId, eventName, schemaVersion, experimentId, assignmentId, userHash, chartHash, shareHash, actionId, actorType, timestamp, source, outcomeCode. No raw birth data.

Events:
- `navigator_exposed`
- `navigator_started`
- `navigator_completed`
- `navigator_share_created`
- `navigator_external_opened`
- `navigator_external_returned`
- `navigator_account_created`
- `navigator_error`

Server-confirmed share/open events are authoritative. Client events reconcile against server records. Idempotency key: userHash + assignmentId + actionId + eventName. Bots, owners, self-opens, and duplicates are excluded.

## Acceptance criteria

- [ ] Repository evidence and existing navigator tests are linked in the implementation PR.
- [ ] Invite-only fake-door gate has exactly defined eligibility and manual-complete behavior.
- [ ] Fake-door passes with ≥8/20 opt-ins, ≥5/20 manual completes, zero unsupported-claim reports, and ≥98% event completeness, or stops safely.
- [ ] Share token is 256-bit random, hashed, non-sequential, rate limited, and owner/admin revocable with audit.
- [ ] Share payload contains only allowlisted fields and no birth inputs/account IDs/coordinates/hidden metadata.
- [ ] Revocation/deletion reaches storage/cache/CDN/previews within 15 minutes with non-revealing responses.
- [ ] Share route verifies noindex/nofollow/no sitemap/canonical/OG/no-referrer behavior.
- [ ] Mobile p75 LCP remains ≤2.5 seconds; no new console errors; keyboard flow is complete; zero critical accessibility violations.
- [ ] Assignment, event schema, idempotency, fixed analysis, and follow-up rules are persisted before rollout.

## Tests required

- [ ] Unit/integration/security tests for payload allowlist, token authorization, enumeration, rate limits, revocation, deletion, cache/preview, retention, and event reconciliation.
- [ ] Browser/accessibility/performance tests for entry, navigator, confirmation, share creation, readback, and revoked/expired/missing states.

## Pre-build validation experiment

Hypothesis:
A visual constellation continuation increases meaningful engagement and safe sharing among completed-chart users.

Cheapest test:
Invite-only fake-door/canary to exactly 20 existing authenticated chart users with no public share route.

Baseline:
Existing navigator starts/completions/shares, chart performance, and event completeness before treatment.

Target:
Canary: ≥8 opt-ins, ≥5 manual completes, zero unsupported-claim reports, ≥98% event completeness. Main experiment: frozen 500 treatment/500 control, persistent 50/50 allocation, baseline primary rate 5%, 10-point absolute MDE, two-sided alpha .05, power .80; if pre-launch power script requires more, freeze the larger number before first assignment.

Success threshold:
Primary navigator-start rate ≥15% with 95% CI lower bound ≥10%, safe-share rate ≥5% of openers, and no performance/accessibility/privacy regression.

Kill threshold:
Canary failure, privacy/auth/lifecycle failure, mobile p75 LCP >2.5 seconds, critical accessibility violation, primary rate <5% after minimum sample, or CI upper bound below 5%. Neutral if sample/event completeness/follow-up is incomplete.

## Rollout

Initial cohort:
Canary first, then authenticated completed-chart users assigned once server-side, 50/50, with 30-day exposure and 30-day follow-up. No anonymous users.

## Success criteria

Primary: unique navigator starts / unique eligible completed-chart users assigned treatment.
Secondary: completion/start, safe-share-created/openers, external return within 30 days, account creation, error rate, privacy/performance/accessibility guardrails.

## Expansion criteria

Only after fixed analysis, canary evidence, lifecycle tests, performance/accessibility gates, and human approval pass. Expand one visual/share variant at a time.

## Kill criteria

Any privacy/auth/lifecycle, performance, accessibility, unsupported-claim, or statistically unsuccessful outcome as defined above.

## Risks

Sensitive-data leakage, unsafe public share route, token abuse, unsupported celestial claims, poor performance, inaccessible visual interaction, weak share demand, and unverified product conversion.

## Out of scope

New SEO cluster, mass page generation, new astronomical claims, automated social posting, paid CTA before product readiness, n8n changes, and production deployment without approval.
