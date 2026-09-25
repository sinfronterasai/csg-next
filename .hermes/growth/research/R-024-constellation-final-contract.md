# R-024 — Birth-Chart Constellation Navigator — Final Contract

Status: RESEARCH

Opportunity: Promote CSG’s existing constellation navigator to completed-chart users as a visual continuation and safe share surface. Search demand UNKNOWN; product-led/social experiment.

Evidence: `src/app/constellations/`, `src/app/api/constellations/natal/route.ts`, `src/lib/constellations/`, and existing constellation tests. Alternatives are standard chart wheels and shareable birth-chart visuals; CSG advantage is a deterministic constellation visualization tied to a verified natal result.

Cheaper pre-build gate: invite-only fake-door to exactly 20 existing authenticated chart users. Eligibility is a chart completed in the prior 30 days with no prior navigator exposure. `opt_in` means user clicks the explanatory entry and confirms interest; `manual_complete` means the current navigator renders the intended constellation view and the user reaches the end-state control; unsupported-claim report means a reviewer flags any claim not present in the verified fact payload. Pass: >=8 opt-ins, >=5 manual completes, zero unsupported-claim reports, >=98% event completeness. Kill: <3 opt-ins, any privacy leak, or any critical accessibility blocker.

Share contract:
- explicit confirmation;
- 256-bit random token, hashed storage, no sequential IDs;
- allowlisted constellation/result fields only; no birth inputs, account IDs, coordinates, hidden metadata, or unsupported claims;
- authenticated owner revocation or support-admin revocation with MFA/audit reason;
- active retention 90 days, automatic expiry, tombstone hash 30 days;
- deletion/revocation propagation to storage/cache/CDN/preview within 15 minutes; same non-revealing 404 for malformed/missing/revoked/expired tokens;
- noindex/nofollow, no sitemap/canonical/OG, no-referrer, rate limit 30 reads/minute/IP/token.

Experiment:
- Assignment unit: authenticated user ID; one server-persisted assignment; repeat visits/charts remain in arm; deleted accounts excluded.
- 50/50 treatment/control; control current chart; treatment entry module; intention-to-treat; no peeking; 30-day exposure plus 30-day follow-up; analysis locks after follow-up.
- Event schema v1 fields: eventId, eventName, schemaVersion, experimentId, assignmentId, userHash, chartHash, shareHash, actionId, actorType, timestamp, source, outcomeCode. No raw birth data. Idempotency key: userHash + assignmentId + actionId + eventName.
- Server-confirmed share/open is authoritative; client event reconciled; bot, owner, self, and duplicates excluded.
- Primary: unique `navigator_started` / unique eligible completed-chart users assigned treatment.
- Secondary: completion/start; safe-share-created/openers; unique external return within 30 days; account creation.
- Frozen enrollment design: 500 treatment and 500 control users, persistent 50/50 allocation, baseline primary rate assumed 5%, minimum detectable absolute lift 10 percentage points, two-sided alpha .05, target power .80, fixed analysis after the 30-day follow-up, no interim looks. If the pre-launch power script shows 500/arm is insufficient for this exact design, the larger computed sample replaces 500/arm before assignment begins; enrollment is then frozen and cannot change mid-test.
- Success: primary >=15% with 95% CI lower bound >=10%; safe-share >=5% of openers; no performance/accessibility/privacy regression.
- Kill: privacy/auth/lifecycle failure; mobile LCP >2.5s at p75; any critical accessibility violation; <5% primary after minimum sample; or CI upper bound below 5%. Neutral if sample/follow-up/event completeness incomplete.

Conversion: navigator → safe share/return → account → verified relevant product. No paid CTA until owner-approved route/checkout/entitlement/delivery/support readiness predicate passes.

Scope: entry module, assignment/events, safe share readback, canary, lifecycle/security/accessibility/performance tests, and analysis script. No SEO cluster.
