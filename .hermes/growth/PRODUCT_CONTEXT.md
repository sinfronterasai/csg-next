# Cosmic Spirit Guide

Domain:
cosmicspiritguide.com

Primary objective:
Acquire qualified users interested in astrology, tarot, and personalized spiritual guidance.

## Current product status

The repository is the source of truth for what is live. The public pricing page currently advertises:

id	created_at	updated_at	title	visibility	headline	description	verified	member_count	route	published_reviews_count	average_review_rating	external_identifier	labels	account.id	account.route	account.title	default_plan	variant_attributes	gallery_images
prod_8H8aEMeAnrd47	2026-09-24T18:35:39.344Z	2026-09-24T18:35:39.344Z	Vocation & Wealth Map	hidden	Decode Midheaven aspects and 2nd/10th House dynamics	Decode Midheaven aspects and 2nd/10th House dynamics for professional alignment. One-time purchase, yours forever.	false	0	vocation-wealth-map	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_9Xbs14dhKBBfR	2026-09-24T02:49:13.947Z	2026-09-24T02:49:13.947Z	Relationship Dynamics Tarot	hidden	Map the energies between you and another person	A 6-card spread that maps the energies between you and another person. Cards are drawn and read in context on Cosmic Spirit Guide.	false	0	relationship-dynamics-tarot	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_KZdIdwEncoyEZ	2026-09-24T02:49:13.947Z	2026-09-24T02:49:13.947Z	Celtic Cross Tarot	hidden	The classic 10-card deep dive	The classic 10-card deep dive into any situation. Cards are drawn and read in context on Cosmic Spirit Guide.	false	0	celtic-cross-tarot	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_lxwI9h69EUqhP	2026-09-24T02:49:13.933Z	2026-09-24T02:49:13.933Z	Career Crossroads Tarot	hidden	Clarity for a work or direction decision	A 6-card spread for a work or direction decision. Cards are drawn and read in context on Cosmic Spirit Guide.	false	0	career-crossroads-tarot	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_pB8vjodAtHhaL	2026-09-24T02:48:12.386Z	2026-09-24T02:48:12.386Z	Yearly Transit Forecast	hidden	A twelve-month map of your strongest transit windows	A deterministic twelve-month map of your strongest transit windows, exact hits, eclipses, and practical timing. One-time purchase, yours forever.	false	0	yearly-transit-forecast	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_ev387zw4HACI9	2026-09-24T02:48:12.377Z	2026-09-24T02:48:12.377Z	Premium Natal Report	hidden	Your complete natal story as a downloadable PDF	Your complete, quality-gated natal story with verified placements, practical integration, and a downloadable PDF to keep. One-time purchase.	false	0	premium-natal-report	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]
prod_nyZX7rXfObDOS	2026-09-24T02:48:12.376Z	2026-09-24T02:48:12.376Z	Love Blueprint	hidden	Your Venus, Mars, and Moon love signature	Your Venus, Mars and Moon signature with the real love aspects colouring your chart. One-time purchase, yours forever.	false	0	love-blueprint-2f	0	0		[]	biz_yXvRBAxPMOzd7b	biz_yXvRBAxPMOzd7b	Cosmicspiritguide			[]


The codebase also contains paid report pipeline support and launch/configuration references for additional report types, including natal premium, yearly transit, vocation/wealth, relationship, and other tarot/astrology reports. Do not describe those as publicly available until the current launch allowlist, checkout flow, UI, and production behavior confirm they are live.

Paid tarot spreads:
See the current application configuration and tarot pricing/entitlement code. The repository currently contains free, Premium ($4.99/month), and Premium Plus ($9.99/month) tarot tiers in the tarot pricing matrix; verify production exposure before making claims.

## Existing capabilities observed in the repository

- Natal chart engine and planetary calculations
- Ephemeris-backed chart facts
- Transit and yearly-transit calculations
- Compatibility and relationship analysis
- Tarot spreads, readings, history, recommendations, and reflection journal
- Moon-phase calculations
- Constellation navigator and natal constellation views
- AI-assisted interpretation through the report pipeline
- Deterministic report facts, editorial compilation, web reports, and PDF generation
- User accounts and profiles
- Payment processing and report purchase/entitlement handling
- Blog and SEO routes

## Traffic constraints

Domain authority is currently low.

Do not assume CSG can rank against major astrology domains for head keywords.

Prioritize:

- Long-tail search
- Programmatic SEO
- Interactive tools
- Underserved queries
- Social discovery
- Share loops
- Backlinks
- Linkable utilities

## Technical stack observed in the repository

- Next.js 15
- React 18
- TypeScript
- PostgreSQL access via `pg` and local/test PGlite support
- Stripe
- Sanity client/content integration
- n8n workflow integration
- Render deployment/runtime integration
- GitHub

Do not assume Prisma is present: no Prisma dependency is listed in the current package manifest.

## Critical rule

Inspect the repository before claiming a feature exists or needs to be built.

Repository reality overrides this document.

When product status is ambiguous, verify all of the following before making a growth claim:

1. The relevant route or component exists.
2. The launch allowlist/configuration permits the feature.
3. Checkout and entitlement handling support it.
4. The production-facing UI advertises it accurately.
5. A real staging or production smoke test confirms the customer path.

Update this document as products, capabilities, pricing, and deployment reality evolve.
