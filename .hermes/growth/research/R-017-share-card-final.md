# R-017 — Shareable Birth-Chart Signature Card — Final Review Candidate

Status: RESEARCH

Opportunity: Add one safe share/export card to the completed free Birth Chart. No SEO pages.

Evidence: CSG already computes deterministic natal facts; the growth skill prioritizes Big Three, dominant element/modality, placements, and share loops. The competitor-gap hypothesis is CSG provenance, unknown-time suppression, and safe public serialization rather than generic inspirational copy. Search demand is UNKNOWN.

Public contract:
- Allowed fields: sign/placement labels, dominant element/modality, safe display sentence, serializer version, calculation version, and created-at bucket without user identity.
- Excluded fields: DOB, exact time, birthplace, coordinates, account ID, email, raw inputs, free text, hidden metadata, and relationship inference.
- Unknown-time-dependent values are omitted at serialization and rendering.
- Public object uses a cryptographically random opaque ID, strict allowlist, maximum lengths, canonical ordering, escaping, and fail-closed validation.
- Explicit user confirmation is required; public route is `noindex`, `nofollow`, `Cache-Control: private, no-store` for creation and controlled public readback, `Referrer-Policy: no-referrer`, rate limited, revocable, deletable, and not listed in sitemaps/OG previews.
- Revoked/deleted/expired IDs return the same non-revealing response whether or not an object existed. Cache/CDN/preview readback must confirm deletion.

Cheapest pre-launch gate:
- schema fuzz/extra-key/missing-key tests;
- unknown-time suppression tests;
- serializer-to-canonical-chart fact comparison;
- opaque-ID enumeration/rate-limit tests;
- XSS/HTML escaping tests;
- revocation/deletion/cache/preview readback tests;
- internal canary with no public indexing.

Experiment:
- Persistent user-level 50/50 assignment among completed-chart users; assignment stored server-side; intention-to-treat analysis.
- 7-day baseline, then 30-day exposure, then 30-day follow-up for late entrants.
- Primary event `share_card_artifact_created` means a valid allowlisted artifact persisted and rendered; numerator is unique eligible users with the event, denominator is unique eligible completed-chart users assigned to treatment.
- Secondary events: `share_card_opened`, `share_card_export_succeeded`, `share_card_returned`, `share_card_account_created`; bots, owner views, duplicate opens, and failed loads excluded.
- Success: >=5% artifact-created rate with >=200 treatment users, 95% CI lower bound >=3%, zero privacy/fact incidents, and no chart-completion regression >=1 absolute point.
- Kill: any privacy/fact incident, failed revocation/deletion, artifact fact mismatch, chart regression >=1 point, or >=200 treatment users with CI upper bound below 3%.
- Retention is reported only after the full 30-day follow-up; it is secondary, not a premature launch gate.

Conversion: explicit relationship-intent interaction → Love Blueprint CTA; no inferred relationship targeting.

Scope: serializer, one visual card, safe public route, lifecycle controls, events, analysis, and security/accessibility tests.
