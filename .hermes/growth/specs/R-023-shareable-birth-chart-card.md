# CSG Growth Specification

ID: R-023

Status: READY

## Opportunity

Add one safe share/export card to completed free Birth Charts using verified non-identifying facts. This is a product/share experiment, not an SEO cluster.

## User intent

A completed-chart user wants a compact, understandable result they can share without exposing their birth data.

## Evidence

CSG has deterministic natal facts and unknown-time safeguards. The proposed advantage is provenance/versioned facts, safe public serialization, and an explicit relationship-intent handoff rather than generic quote art. Search demand is UNKNOWN.

## Existing SERP competitors

No SEO competitor claim is required for this product-led experiment. Generic astrology share cards are the alternative class; exact market demand remains UNKNOWN.

## Why CSG can realistically compete

The feature extends the existing verified chart result and can be validated with current chart users. It does not depend on winning a new head-term SERP.

## CSG differentiator

Only verified, allowlisted chart facts are rendered; unknown-time fields are suppressed; the public artifact carries calculation/serializer provenance and a safe lifecycle.

## Acquisition channel

SEO: None for initial rollout; share routes are non-indexed.
Social: User-initiated share/export.
Referral: External recipients returning through opaque share URLs.
Direct: Existing completed-chart users.

## Product experience

1. Authenticated user completes a free Birth Chart.
2. Treatment assignment exposes one share-card CTA.
3. User explicitly confirms sharing.
4. CSG creates a safe artifact containing only allowlisted facts.
5. User exports or copies the opaque URL.
6. External visitors see the safe card; they cannot see birth inputs or account data.
7. Relationship CTA appears only after an explicit relationship-intent interaction.

## URLs

Existing chart result route plus a new controlled share-card creation/readback route. Exact paths are implementation decisions recorded in the spec PR before coding. No sitemap, canonical, OG, or indexable listing.

## Data requirements

Allowed: sign/placement/element/modality/display text, schemaVersion, calculationVersion, serializerVersion, immutable snapshotDigest, created-at bucket.
Excluded: DOB, exact time, birthplace, coordinates, account ID, email, raw inputs, free text, hidden metadata.

Storage: immutable snapshot keyed by a hash of a 256-bit random token; active retention 90 days; automatic expiry; 30-day tombstone hash after revocation/deletion.

## Deterministic calculations

Read facts from the canonical verified chart result. Omit all unknown-time-dependent values at serialization and rendering. Store calculation and serializer versions plus snapshot digest. Fail closed on invalid, missing, extra, or non-allowlisted fields.

## AI-generated components

None. No AI may alter chart facts or infer relationship intent from chart fields.

## UI requirements

- Explicit confirmation before public creation.
- Clear statement of what will be shared.
- Unknown-time messaging.
- Loading, creation failure, revoked, expired, and missing states.
- Keyboard and screen-reader accessible CTA.
- No hidden metadata or sensitive preview payloads.

## SEO requirements

Title pattern:
CSG Birth Chart Signature — shared result

Meta pattern:
Short factual description of the shared signature without birth data.

Schema:
No public structured data that exposes personal chart details.

Canonical behavior:
No canonical URL for public share objects.

Indexing behavior:
`noindex,nofollow`; no sitemap, OG, or public listing; no-referrer.

Hub page:
None.

Internal links:
Only controlled return links to the CSG chart/account experience.

## Conversion path

Entry page
→ completed free chart
→ explicit share-card interaction
→ safe result/share URL
→ return/account
→ explicit relationship-intent interaction
→ Love Blueprint

## Distribution assets

One share image/export format and one opaque share URL. No automated spam distribution.

## Analytics events

Schema v1 fields: eventId, eventName, schemaVersion, experimentId, assignmentId, userHash, chartHash, artifactHash, actionId, actorType, timestamp, source, outcomeCode. No raw birth data.

Events:
- `share_card_exposed`
- `share_card_created`
- `share_card_export_succeeded`
- `share_card_external_opened`
- `share_card_external_returned`
- `share_card_account_created`
- `share_card_fact_error`

Idempotency: userHash + assignmentId + actionId + eventName. External open excludes owner, bots, same-session self-open, and duplicates.

## Acceptance criteria

- [ ] Allowlist and exclusion schema is enforced at storage, render, preview, and analytics layers.
- [ ] Unknown-time fields are omitted in all outputs.
- [ ] Token is 256-bit random, stored hashed, non-sequential, and rate limited.
- [ ] Authenticated owner/support-admin revocation requires authorization and audit reason.
- [ ] Revocation/deletion reaches primary storage, cache, CDN, and previews within 15 minutes; readback is non-revealing.
- [ ] Active retention is 90 days with automatic expiry and tombstone behavior.
- [ ] Noindex/nofollow/no-referrer/no-listing behavior is verified at HTTP and rendered-preview levels.
- [ ] 20-chart canary passes fact diff, fuzz, XSS, enumeration, lifecycle, and event-completeness gates.
- [ ] Treatment assignment and fixed analysis rules are persisted before rollout.

## Tests required

- [ ] Schema, canonical-fact, unknown-time, XSS, rate-limit, authorization, token enumeration, revocation/deletion, cache/preview, and retention tests.
- [ ] Browser/accessibility tests for explicit confirmation, creation, export, public readback, revoked/expired/missing states, and event reconciliation.

## Pre-build validation experiment

Hypothesis:
A safe, provenance-backed signature card increases user-initiated sharing without exposing sensitive birth data.

Cheapest test:
20 approved test charts through an internal canary, then a 50/50 user-level treatment/control experiment.

Baseline:
Seven-day completed-chart volume, existing return rate, chart completion, and event completeness.

Target:
Minimum 1,000 treatment and 1,000 control users, or a preregistered two-proportion power calculation at baseline 1%, target 5%, alpha .05, power .80, whichever is larger.

Success threshold:
Artifact-created rate ≥5%, 95% CI lower bound ≥3%, no chart-completion regression ≥1 absolute point, zero privacy/fact incidents.

Kill threshold:
Any privacy/fact/lifecycle incident, chart regression, failed revocation/deletion, or CI upper bound below 3% after minimum sample. Neutral if sample/event completeness/follow-up is incomplete.

## Rollout

Initial cohort:
Authenticated completed-chart users assigned once server-side, 50/50, with 30-day exposure and 30-day follow-up. No anonymous users.

## Success criteria

Primary: unique users with a valid artifact-created event / unique eligible completed-chart users assigned to treatment.
Secondary: export success, external opens, external returns, account creation, fact-error rate, privacy incidents.

## Expansion criteria

Only after the fixed analysis, canary evidence, privacy readback, and human approval pass. Expand card variants only one at a time.

## Kill criteria

Privacy, fact, lifecycle, chart-completion regression, or statistically unsuccessful outcome as defined above.

## Risks

Sensitive-data exposure, stale/cache previews, token enumeration, incorrect facts, accidental relationship inference, share friction, and misleading conversion attribution.

## Out of scope

Public SEO pages, automated social posting, inferred relationship targeting, public birth data, new report engines, n8n changes, and production deployment without review.
