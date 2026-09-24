# R-021 — Shareable Birth-Chart Signature Card — Review Resubmission

Status: RESEARCH

Opportunity: Add one safe share/export card to completed free Birth Charts using verified non-identifying facts.

Evidence and differentiation: CSG has deterministic natal facts and unknown-time safeguards. The CSG advantage is provenance/versioned facts, safe public serialization, and an explicit relationship-intent handoff—not generic quote art. Search demand is UNKNOWN.

Public contract: allowlisted sign/placement/element/modality/display fields only; exclude DOB, exact time, birthplace, coordinates, account ID, email, raw input, free text, and hidden metadata. Unknown-time fields omitted. Serializer schema/calculation version and immutable snapshot digest included. Opaque 256-bit random ID, noindex/nofollow, no sitemap/canonical/OG listing, no referrer, no-store on creation, controlled public readback, rate limit 30 reads/minute/IP/object, revocation/deletion within 15 minutes, non-revealing missing/revoked response, cache/preview purge readback, explicit user confirmation.

Cheapest pre-build gate: internal canary with 20 approved test charts; schema fuzz/extra-key/missing-key/XSS tests; canonical fact diff; unknown-time suppression; enumeration/rate-limit; revocation/deletion/cache/preview readback. Pass requires 100% fixture/fact agreement, zero privacy-field leakage, zero revocation/readback failures, and >=98% event completeness.

Experiment protocol: persistent user-level 50/50 assignment among completed-chart users; one assignment per user; control unchanged; intention-to-treat; 30-day exposure plus 30-day follow-up for late entrants; no peeking; fixed analysis after follow-up.

Events: `share_card_exposed`, `share_card_created`, `share_card_export_succeeded`, `share_card_external_opened`, `share_card_external_returned`, `share_card_account_created`, `share_card_fact_error`. A successful artifact requires allowlisted persisted snapshot plus successful render; an external open excludes owner, bots, same-session self-open, and duplicate opens. External return is a unique non-owner session returning to CSG within 30 days of first external open. Primary denominator is unique eligible completed-chart users assigned to treatment; secondary denominator is unique successful artifacts.

Minimum sample/decision: 200 treatment and 200 control users. Primary success is artifact-created rate ≥5% with 95% CI lower bound ≥3%, no chart-completion regression ≥1 absolute point, and zero privacy/fact incidents. Kill on any privacy/fact incident, failed revocation/deletion, chart regression, or CI upper bound below 3% after minimum sample. Neutral/inconclusive if minimum sample or event completeness is not reached.

Conversion: only after explicit relationship-intent interaction, show Love Blueprint CTA. No inference from chart fields.

Scope: serializer, one card, lifecycle route, privacy/security tests, event contract, analysis script, and safe CTA. No SEO cluster.
