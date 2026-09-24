# R-022 — Birth-Chart Constellation Navigator — Review Resubmission

Status: RESEARCH

Opportunity: Promote CSG’s existing constellation navigator to completed-chart users as a visual continuation and safe share surface. Search demand is UNKNOWN; this is a product-led/social test.

Evidence: repository evidence is specifically `src/app/constellations/`, `src/app/api/constellations/natal/route.ts`, `src/lib/constellations/`, and existing constellation tests. Existing alternatives include standard chart wheels and shareable birth-chart visual products; the CSG gap is a deterministic constellation visualization connected to the verified natal result, not a broad SEO claim.

Cheaper pre-build test: an invite-only fake-door/canary to 20 existing chart users. Show an explanatory navigator entry, record opt-in/start intent, but do not expose a public share route. Pass to implementation experiment only if >=8/20 opt in, >=5 complete a manual/current navigator flow, zero unsupported-claim reports, and event completeness >=98%. Kill if <3 opt in, any privacy leak, or accessibility blocker.

Share contract: explicit confirmation; opaque 256-bit token; allowlisted constellation/result fields only; no birth inputs, account IDs, coordinates, hidden metadata, or unsupported celestial claims; noindex/nofollow/no sitemap/canonical/OG exposure; revocation/deletion within 15 minutes; non-revealing missing/revoked response; rate limits; no referrer leakage.

Experiment: persistent user-level 50/50 assignment among completed-chart users, one assignment per user, control current chart, treatment entry module, intention-to-treat, 30-day exposure and 30-day follow-up, no peeking, fixed analysis after follow-up.

Events: `navigator_exposed`, `navigator_started`, `navigator_completed`, `navigator_share_created`, `navigator_external_opened`, `navigator_external_returned`, `navigator_account_created`, `navigator_error`. Server-confirmed share creation/open events are authoritative; client events are reconciled; idempotency key is user/assignment/event-version/action ID. External open excludes owner, bots, duplicate opens, and same-session self-open.

Metrics: primary unique navigator starts / unique eligible completed-chart users assigned to treatment. Secondary completion/start, safe-share/open, unique external return within 30 days, account creation. Minimum 200 eligible users per arm. Success: primary rate ≥15% with 95% CI lower bound ≥10%, safe share ≥5% of openers, no performance/accessibility/privacy regression. Kill: any privacy/auth issue, performance budget breach, accessibility blocker, <5% starts after minimum sample, or CI upper bound below 5%. Neutral if minimum sample or follow-up is incomplete.

Performance/accessibility gates: mobile LCP ≤2.5s on the tested route, no new console errors, keyboard-complete flow, screen-reader labels for entry/share controls, and zero critical accessibility violations in automated/manual review.

Conversion: navigator → safe share/return → account → verified relevant product. Paid CTA is absent until an owner-approved destination readiness checklist passes.

Scope: entry module, assignment/events, safe share readback, canary, performance/accessibility/security tests, and analysis script. No new SEO cluster.
