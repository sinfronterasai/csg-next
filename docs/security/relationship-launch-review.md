# Relationship offer security regression evidence

Review scope: the relationship-access endpoint, authenticated reading handoff, and the existing payment/refund lifecycle. This is focused security validation, not a claim that a general security scanner found no issues.

Controls verified by tests:
- Anonymous or invalid-token callers receive signed_out without a database lookup or personal data.
- The read-only access response is private/no-store.
- A buyer must have an active relationship_dynamics entitlement (user ID or matching account email) or an existing qualifying tier. No query parameter, checkout click or client flag grants entitlement.
- Database failure returns 503, and the UI withholds checkout rather than suggesting a repeat payment.
- The disposable SQL integration test runs locked -> payment.succeeded -> unlocked -> generation/save -> duplicate -> refund -> locked -> payment replay remains locked.
- Webhook raw-body signature rejection tests cover tampered requests. No webhook signing key or production credentials are included in fixtures.
- Campaign telemetry sends product and source identifiers, not email, question text, birth details or reading content.

Reproduce:

    npm test -- --runInBand tests/tarot/relationship-access.test.ts tests/tarot/RelationshipOfferActions.test.tsx tests/billing/whop-webhook.test.ts
    npm test -- --runInBand tests/billing/relationship-purchase-loop.test.ts

The first preparation completed these checks successfully. The integration uses synthetic auth and a stubbed AI response with real local SQL, draw and persistence code. It must not be mistaken for live payment or provider validation.

No security protection, billing gate, scanner gate, repository protection or production permission was disabled. The isolated fixtures do not use DATABASE_URL or production accounts. Live payment/reading verification remains required before the approved social publication.
