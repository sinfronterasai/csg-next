# Cosmic Spirit Guide team execution board

Date: 2026-09-04
Source brief: `/workspace/handoffs/CSG-POST-CUTOVER-P0-P1-FIX-BRIEF-2026-09-04.md`
Repository: `/home/hermes/.hermes/csg-next` or a clean isolated worktree from `github.com/sinfronterasai/csg-next`
Production service: `csg-next` on Render

## Protocol

- Read the source brief completely before claiming work.
- Inspect current `origin/main`; do not develop from a dirty or divergent checkout.
- Use a new isolated worktree and one branch per PR.
- Follow strict RED → GREEN → full verification.
- Never expose credentials or change production/external systems without owner authorization.
- Do not weaken server-side launch, payment, auth, or ownership checks.
- Do not merge or deploy your own work. John independently verifies and controls release.
- Record exact branch, commit SHA, test output, and remaining blockers below.

## Status board

| ID | Task | Owner | Status | Dependency | Artifact / evidence |
|---|---|---|---|---|---|
| P0-ROUTE | Fix `/profile → /dashboard → 404`; keep `/profile` canonical and make `/dashboard` a compatibility redirect | Wario (Pike fallback) | TODO | none | Pike run blocked before tool use; Wario to implement |
| LB-PUBLIC | Remove only the Love Blueprint invite/user-ID gate; retain payment/auth and all other launch gates; update UI, pricing, metadata, Terms, tests | Wario (Pike fallback) | TODO | P0-ROUTE merged or separate clean worktree | Pike run blocked before tool use; Wario to implement |
| AUTH-UX | Authenticated-login redirect, stable header auth state, mobile-menu accessibility, signed-out Tarot-history login CTA | Wario | TODO | rebase after P0-ROUTE | PR + exact SHA + tests |
| TRUTH-UX | Remove/relabel unavailable offers; eliminate fake newsletter success; repair footer; moon checkbox label; favicon; analytics copy | Wario | TODO | coordinate SiteHeader ownership with AUTH-UX | PR + exact SHA + tests |
| REVIEW-P0 | Adversarial review of P0 route patch and live staged auth flow | Wario | TODO | Pike P0 candidate | written verdict + evidence |
| REVIEW-LB | Adversarial review that public Love Blueprint does not bypass checkout and other reports remain blocked | Wario | TODO | Pike LB candidate | written verdict + evidence |
| EXTERNAL-QA | Re-test staged signup/login/profile/logout, Love Blueprint funnel, truthful CTAs, mobile, and signed-out states | Grokbot | TODO | staged candidates | external QA report |
| RELEASE | Verify, merge, deploy, and read back exact approved commits | John | TODO | approved candidates | GitHub/Render/live evidence |

## Product decision — authoritative

Love Blueprint is no longer invite-only. Cosmic Spirit Guide does not have an audience large enough to justify an invitation funnel. It must become the public paid launch report.

This decision does not authorize free generation or bypassing checkout. Authentication, birth-data prerequisites, Stripe purchase, entitlement, report-pipeline validation, bounded revision, and human-editor escalation remain required.

## Wario relay message

Read:

`/workspace/handoffs/CSG-POST-CUTOVER-P0-P1-FIX-BRIEF-2026-09-04.md`

and:

`/workspace/handoffs/TEAM-EXECUTION-BOARD-2026-09-04.md`

Claim `P0-ROUTE` first, then `LB-PUBLIC` in a separate clean branch/worktree. Pike received both tasks but could not begin because every approved free provider was unavailable. After those two candidates are ready, claim `AUTH-UX` and `TRUTH-UX`; keep the SiteHeader work in one branch to prevent overlap. Do not merge/deploy. Report branch, exact commit SHA, commands/results, and blockers by updating the board or writing a response artifact under `/workspace/handoffs/wario/`.

## Grokbot relay message

After staged candidates exist, re-run the specific affected flows rather than another broad crawl: signup → profile, login → profile, My Profile, logout, signed-out Tarot history, public Love Blueprint checkout prerequisites, unavailable-product CTAs, newsletter state, footer links, moon-time checkbox semantics, mobile menu accessibility, favicon, and analytics/cookie claims. Record expected versus actual behavior and exact URLs. Do not create a live Stripe charge.
