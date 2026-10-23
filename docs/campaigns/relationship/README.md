# Relationship Dynamics first-sale campaign

## What Ethan reviews

One $4.99 offer, a six-card editorial example, three campaign graphics and three exact Facebook post drafts. Start with REL-FB-001, on the Cosmic Spirit Guide Page only. No ad spend, discount, subscription, fabricated review, false scarcity, or sales guarantee.

## What changed

- Added /tarot/relationship-dynamics with six perspectives, an explicitly labelled editorial demonstration, account-aware purchase controls and support/recovery instructions.
- Access is checked server-side; an inaccessible database never becomes a request to pay again.
- Signup/login switching preserves the return destination. After a verified entitlement, the reading link opens Relationship Dynamics directly and still requires the buyer's question before generation.
- Removed misleading Member/Cosmic Pass language from the tarot picker and locked-reading message. The existing purchase grants access to the specific spread; this campaign does not change the entitlement's duration or consumption rules.
- Added relevant offer links to quiz results and completed readings, without requiring the quiz to purchase.
- Added campaign events for offer views, checkout clicks, and paid reading starts/completions. Checkout clicks are not purchases. No question, email, birth data or reading content is included in those events. No new purchase event is emitted from the client.
- The relationship interpretation prompt explicitly avoids claiming knowledge of another person's private thoughts or guaranteed outcomes.

## Honest example

The six example cards are drawn by CSG's real seeded engine using csg-relationship-example-v1. A test checks the displayed cards against the draw. Interpretation is authored editorial demonstration, not a live AI result, customer reading or testimonial. It is labelled as such on the offer page.

## Proposed launch sequence

1. Approve and deploy the reviewed code. No production action has occurred in this preparation.
2. Live smoke check the page, signup return path, access check, production AI availability, same-email payment matching, reading persistence and history. Confirm Whop plan is the intended $4.99 one-time product and that fulfillment webhook delivery is healthy. Do not infer purchase success from a 200 response or a checkout click.
3. If a sandbox transaction is available, exercise it. A real charge is outside the $0 budget and requires a separately authorized amount. Existing test entitlement/access can validate reading delivery without a charge, provided access is legitimately available; never forge or bypass a production payment gate.
4. Publish REL-FB-001 only after the live gate passes. Image URL is the production domain plus its checked-in public asset path.
5. Observe external offer visits, checkout clicks, successful readings and confirmed orders. Follow-up posts stay drafts until results justify them.

## Distribution limits and expansion

The connected Facebook interface can publish to the named Page. Pinterest is currently read-only; its asset/caption is ready but no automatic posting is claimed. Personal Instagram is outside the initial launch scope. Existing Page reach is small, so this preparation alone does not establish enough audience to generate a sale.

Candidate community placements from the prior research: The Spiritual Entrepreneurs Network (facebook.com/groups/thespiritualentrepreneursnetwork) and Witchcraft, Occult And Magick News (facebook.com/groups/131918400660800). Public search did not establish current rules or permission for AI-assisted products; do not post without verification/admin approval. No group membership or messaging capability was established. These are research candidates, not approved destinations.

Admin-permission draft (unsent):

“Hi, I run Cosmic Spirit Guide. Would your group allow one transparent product post for an AI-assisted six-card tarot reading? It costs $4.99 one time, and the page shows a full labelled example before purchase. I would disclose that it uses AI, follow your promotion rules, and not DM members. If that isn't a fit, no problem.”

After-purchase feedback text (draft only, not wired to email):

“Was your Relationship Dynamics reading easy to access, and was there one part you found useful? If something didn't work, reply with the issue so we can help. Please don't send private relationship details or card information.”

No automatic customer email is promised by this branch. Readings remain available through existing history. Feedback collection should be added to an established, authorized delivery channel after inspecting it.

## Validation

Validation completed: 49 focused tests passed across 13 suites; the SQL purchase/refund integration test passed separately; TypeScript checks and the production build passed. The broader tarot run also exposed existing reflection tests that need a configured database; those were not claimed as passing. Focused regression tests, a disposable PostgreSQL-compatible integration test and a production build are included in preparation. The integration test uses real SQL and the real entitlement/draw/save code, but synthetic authentication and a stubbed AI response. It verifies locked → confirmed payment → unlocked → persisted reading → refund/replay → locked. It is not a live Whop/Groq transaction.

## Known follow-up

The authenticated production payment-to-reading path remains a launch gate because this environment has no production JWT/Groq/database credentials or Whop sandbox session. No secret is requested in chat. Server-side purchase-to-GA4 reconciliation is not implemented here; use the provider's confirmed orders as the revenue source of truth.

Broader pre-existing tarot database tests cannot run without a configured disposable database; do not point them at production. No migrations are needed by this change beyond the already-required users, whop_entitlements and campaign-event tables.
