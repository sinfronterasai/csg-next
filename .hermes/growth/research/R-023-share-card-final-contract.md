# R-023 — Shareable Birth-Chart Signature Card — Final Contract

Status: RESEARCH

Opportunity: Add one safe share/export card to completed free Birth Charts using verified non-identifying facts.

Evidence/differentiation: CSG deterministic natal facts and unknown-time safeguards; advantage is provenance/versioned facts, safe public serialization, and explicit relationship-intent handoff. Search demand UNKNOWN; this is a product/share experiment.

Public object contract:
- Allowlisted sign/placement/element/modality/display fields only.
- Exclude DOB, exact time, birthplace, coordinates, account ID, email, raw inputs, free text, and hidden metadata.
- Omit all unknown-time-dependent fields.
- Include schemaVersion, calculationVersion, serializerVersion, immutable snapshotDigest, createdAt bucket.
- Use a 256-bit random token stored hashed; no sequential IDs.
- Creation requires authenticated owner confirmation; revocation requires authenticated owner action or support-admin action with audit reason and MFA.
- `DELETE /share-cards/:token` transitions active → revoked; hard-delete primary object within 15 minutes; purge CDN/cache/OG preview/event payload references within 15 minutes; readback must return the same non-revealing 404 for revoked, deleted, expired, malformed, and nonexistent tokens.
- Retention: active 90 days, automatic expiry; revoked/deleted artifacts retained only as a tombstone hash for 30 days to prevent replay, with no readable content.
- Creation response is no-store; public readback is noindex/nofollow, no sitemap/canonical/OG listing, no referrer, and rate limited to 30 reads/minute/IP/token.
- SLA owner: Growth Developer on-call; alert at 10 minutes, kill switch at 15 minutes.

Pre-build gate: 20 approved test charts; schema fuzz, XSS, unknown-time, canonical-fact diff, token enumeration/rate-limit, authorization, revocation/deletion/cache/preview, and tombstone readback tests. Pass requires 100% fixture agreement, zero privacy leakage, zero unauthorized read/delete, zero lifecycle readback failures, and >=98% event completeness.

Experiment contract:
- Assignment unit: authenticated user ID; anonymous chart users are ineligible.
- Assignment is persisted server-side once per user; repeated charts remain in the same arm; deleted accounts are excluded from analysis.
- 50/50 treatment/control; control unchanged; intention-to-treat; no peeking; analysis locks 30 days after final exposure.
- Event schema v1 fields: eventId, eventName, schemaVersion, experimentId, assignmentId, userHash, chartHash, artifactHash, actionId, actorType, timestamp, source (server/client), outcomeCode. No raw birth data.
- Idempotency key: userHash + assignmentId + actionId + eventName.
- Primary event: `share_card_created` means allowlisted immutable object persisted and rendered; duplicate/retry events collapse by artifactHash.
- External open excludes owner, bots, same-session self-open, and duplicate opens; external return is unique non-owner session returning within 30 days.
- Minimum: 1,000 treatment and 1,000 control users, or the pre-registered two-proportion power calculation at baseline 1%, target 5%, alpha .05, power .80, whichever is larger.
- Success: primary artifact-created rate >=5%, 95% CI lower bound >=3%, no chart-completion regression >=1 absolute point, zero privacy/fact incidents.
- Kill: any privacy/fact/lifecycle failure, chart regression, or CI upper bound below 3% after the minimum sample; neutral if event completeness/sample/follow-up incomplete.

Conversion: explicit relationship-intent interaction → Love Blueprint CTA. No chart-field inference.

Scope: serializer, one card, lifecycle route, event contract, analysis script, privacy/security tests, safe CTA. No SEO cluster.
