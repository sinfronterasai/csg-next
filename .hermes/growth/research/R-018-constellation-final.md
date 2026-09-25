# R-018 — Birth-Chart Constellation Navigator Share Surface — Final Review Candidate

Status: RESEARCH

Opportunity: Promote CSG’s existing constellation navigator to completed-chart users as a visual continuation and safe share surface. Search demand is explicitly UNKNOWN; this is a product-led/social experiment.

Evidence: repository evidence includes constellation catalog, natal constellation, coordinates, navigator UI, and existing browser/test coverage. The gap is an interactive visual experience with verified inputs, not a claim of a broad SEO opening.

Public share contract:
- explicit confirmation;
- opaque non-sequential token;
- allowlisted constellation/result fields only;
- no birth date/time/place, coordinates, account identifiers, or hidden metadata;
- noindex/nofollow, no sitemap/OG listing, revocation/deletion, rate limiting, and non-revealing missing/revoked response;
- no unsupported astronomical claims.

Pre-launch gate:
- implement versioned event schemas and persistent assignment storage;
- run a 7-day instrumentation canary with no public share route;
- verify >=98% event completeness, <=1% duplicate events, assignment persistence, and server/client reconciliation;
- run keyboard/screen-reader, mobile performance, token-guessing, authorization, revocation, deletion, metadata-leak, and payload-allowlist tests;
- define performance budgets before treatment.

Experiment:
- 50/50 persistent user-level assignment among completed-chart users; intention-to-treat.
- 30-day exposure plus 30-day follow-up for late entrants.
- Primary metric: unique navigator starts / unique eligible completed charts assigned to treatment.
- Secondary: unique navigator completions / starts; safe share artifacts / navigator openers; unique shared visitors returning within 30 days; account creation.
- Success: >=15% navigator-start rate with >=200 eligible treatment users and 95% CI lower bound >=10%; >=5% safe-share rate among openers; no performance/accessibility/privacy regression.
- Kill: any privacy/auth/privacy payload incident; performance budget breach; fewer than 5% starts after >=200 eligible treatment users; or 95% CI upper bound below 5%.
- Retention is evaluated only after the complete follow-up window.

Conversion: navigator → safe share/return → account → verified relevant product. No paid CTA until product status is independently verified.

Scope: entry module, event contract, assignment, safe share readback, instrumentation, and accessibility/performance/security tests.
