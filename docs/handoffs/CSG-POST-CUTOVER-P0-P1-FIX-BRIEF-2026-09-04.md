# CSG post-cutover P0/P1 fix brief

Date: 2026-09-04
Target: `sinfronterasai/csg-next` on Render service `csg-next`
Production: `https://cosmicspiritguide.com`

## Executive decision

The Grokbot report contains a real launch-blocking account-routing defect and several valid conversion/trust defects. It also mixes one stale claim with one unverified claim. Fix the P0 separately and ship it first. Do not bundle payment, newsletter-provider, or password-reset architecture into the routing hotfix.

## Independently verified current state

### P0 — confirmed: successful authentication leads to a dead account route

Evidence:

- `GET /profile` returns `301` to `https://cosmicspiritguide.com/dashboard`.
- `GET /dashboard` returns `404`.
- `src/app/login/page.tsx` sends successful login to `/profile`.
- `src/app/signup/page.tsx` sends successful registration to `/profile`.
- `src/components/SiteHeader.tsx` links “My Profile” to `/profile`.
- A complete profile experience already exists at `src/app/profile/page.tsx`.
- The break is introduced by `src/lib/seo/redirect-map.ts`, which incorrectly redirects `/profile` to `/dashboard`.

Required fix:

1. Stop redirecting `/profile` away from the real profile page.
2. Make `/dashboard` redirect to `/profile` as a compatibility alias, or add an equivalent route-level redirect.
3. Add regression coverage proving:
   - unauthenticated `/profile` reaches the profile application and then sends the user to `/login`;
   - authenticated `/profile` renders the account experience;
   - `/dashboard` redirects to `/profile` rather than returning 404;
   - login, signup, and both desktop/mobile “My Profile” links resolve to the working account route.
4. Exercise a real throwaway signup/login/logout flow against staging before production deployment.

Acceptance criteria:

- No `/profile → /dashboard → 404` chain.
- A newly registered user lands on “Your Cosmic Profile.”
- A returning user who signs in lands on “Your Cosmic Profile.”
- “My Profile” works in desktop and mobile navigation.
- Sign-out returns to the public home page and the authenticated header controls disappear.

## P1 — confirmed auth and account friction

### No password recovery

- No reset/forgot-password implementation was found.
- `GET /forgot-password` returns 404.

Required product decision before implementation:

- Select the email delivery provider and reset-token lifecycle. Email provider remains TBD; do not fake a recovery success state.

Acceptance criteria when implemented:

- Login exposes “Forgot password?”
- Reset requests do not disclose whether an email exists.
- Tokens are single-use, short-lived, securely stored/hashed, and invalidated after use.
- Rate limiting and successful end-to-end email delivery are tested.

### Authenticated `/login` still renders the login form

Confirmed in source: the login page does not redirect an already authenticated user.

Required fix:

- If `/api/auth/user` succeeds, replace or redirect the login surface to `/profile`.
- Avoid a visible login-form flash while auth state is resolving.

### Header flashes an ellipsis

Confirmed at `src/components/SiteHeader.tsx`: unresolved auth renders a visible `…`.

Required fix:

- Reserve the control width with a non-verbal skeleton or render stable neutral space.
- Preserve layout and prevent cumulative shift.

### Mobile menu control lacks an accessible name

Confirmed: the mobile menu button has no `aria-label`, `aria-expanded`, or `aria-controls`.

Required fix:

- Add an explicit accessible name and state attributes.
- Verify keyboard activation, focus order, and Escape-to-close behavior.

### Signed-out tarot history shows a raw failure

Confirmed:

- `/api/tarot/history` correctly returns 401 when signed out.
- `src/app/tarot/history/page.tsx` collapses every non-OK response to “Failed to load history.”

Required fix:

- Handle 401 separately with a friendly signed-out state and direct `/login?next=/tarot/history` CTA.
- Preserve a distinct retryable state for genuine network/server failures.

## User-approved product change — remove the Love Blueprint invite gate

Owner decision: Love Blueprint must no longer require an invitation or private-beta user allowlist. The site does not yet have an audience large enough to justify an invite-only funnel. Love Blueprint should become the public paid launch report.

Current restriction points that must be removed or updated together:

- `src/lib/launch/allowlist.ts` blocks Love Blueprint checkout and generation unless the authenticated user ID appears in `LOVEBLUEPRINT_BETA_USER_IDS`.
- `src/app/reports/ReportsView.tsx` labels the product “Invite only,” uses `REQUEST INVITE`, and converts 403 responses into an invite-only message.
- `src/app/pricing/page.tsx` and its metadata describe Love Blueprint as invite-only.
- `src/app/terms/page.tsx` says Love Blueprint is offered by invite.
- Launch tests encode the private-beta behavior and must be changed test-first.

Required behavior:

1. Keep Love Blueprint in the server-authoritative paid launch allowlist.
2. Remove only the private-beta user-ID check from checkout and generation. Do not broaden access to other unreleased report types.
3. Remove the `LOVEBLUEPRINT_BETA_USER_IDS` dependency and obsolete beta-only error code only after all references and tests are accounted for.
4. Replace invite-only UI/copy with a truthful public paid-product state and a checkout CTA.
5. Require authentication and a saved birth chart where the actual generation/checkout contract requires them; send users through those prerequisites rather than a dead end.
6. Verify the configured Stripe Love Blueprint price, checkout success/cancel URLs, signed webhook, purchase record, entitlement, report dispatch, callback, editor escalation, and final report delivery before calling the product purchasable.
7. Preserve the launch gate for every other unreleased report.

Acceptance criteria:

- Any authenticated eligible customer can start Love Blueprint checkout without an invite-list membership.
- A non-allowlisted ordinary user no longer receives `beta_not_allowlisted`.
- Love Blueprint checkout cannot be bypassed merely because the invite gate was removed.
- Other unreleased report types remain blocked server-side.
- Reports, Pricing, Terms, metadata, and error messages contain no invite-only/private-beta claims for Love Blueprint.
- End-to-end Stripe test mode and report-pipeline evidence are recorded before production activation.

## P1 — confirmed truth-in-marketing mismatches

### Public marketing advertises products that `/reports` intentionally does not sell

Confirmed:

- The reports launch allowlist contains only the free Birth Chart Report and invite-only Love Blueprint.
- The header dropdown advertises Yearly Transit, Synastry, Vocation, paid Tarot, and Live Zoom with prices.
- Homepage `Services` advertises Yearly Transit, Synastry, Vocation, and Live Zoom with prices and actionable labels.
- Those report links lead to `/reports`, where the advertised products cannot be purchased.

Required content/product correction:

- Until each offer is truly purchasable, either remove it from active navigation/cards or label it “Coming soon” without a price or purchase-style CTA.
- Keep the current honest `/pricing` message: free Birth Chart plus invite-only Love Blueprint.
- Do not imply a certified “cosmic high-priestess” or live Zoom service unless the real provider, qualification, scheduling, and fulfillment process exist.

Acceptance criteria:

- Every displayed price corresponds to a working checkout and deliverable.
- Every active product CTA lands on the exact product or a truthful waitlist.
- Unreleased products cannot look purchasable.

### Reports “Start Free” bypasses required birth-data setup

Confirmed:

- The primary button immediately calls report generation.
- The API can respond with `requiresBirthChart`, after which the page says to create a chart elsewhere.

Required fix:

- For visitors without saved birth data, make the primary CTA open `/birth-chart` or embed the birth-data capture step.
- For eligible authenticated users with saved data, generation may proceed directly.
- Preserve user-entered data and return path.

Acceptance criteria:

- A first-time visitor is never sent into a known failure path.
- The CTA label accurately describes the next action.
- After chart creation, the user can return to report generation without re-entering birth data.

### Newsletter form claims a subscription without subscribing anyone

Confirmed: `src/components/Newsletter.tsx` prevents submission and runs `alert('Subscribed!')`; no subscribe API is called.

Required immediate correction:

- Remove the fake success behavior.
- Until an email provider is selected, replace the form with a truthful “Dispatch coming soon” state or hide it.
- Once a provider is selected, add consent language, API validation, abuse protection, durable storage/provider confirmation, and a real success/error state.

## P1/P2 — confirmed navigation and footer defects

### Footer links are placeholders and footer is home-only

Confirmed:

- Brand, legal, contact, and all social icons use `href="#"`.
- Two navigation anchors work only on the homepage.
- `Footer` is mounted by `HomeView`, not the root layout, so most subpages have no footer.

Required fix:

- Link the brand to `/`.
- Link Privacy, Terms, and Contact to their real routes.
- Remove nonexistent social links rather than sending users to `#`.
- Use homepage-qualified anchors such as `/#about` where sections remain intentional.
- Mount a shared footer in the root layout and remove the homepage-only duplicate.

### Favicon missing

Confirmed: `GET /favicon.ico` returns 404.

Required fix:

- Add a real favicon/app icon and verify the generated metadata/link response.

### Moon calculator checkbox label is inverted

Confirmed:

- Checkbox state is `unknownTime`.
- Checked disables the time field.
- Visible label says “Include birth time for accuracy.”

Required fix:

- Label it “I don’t know my birth time” or invert the control semantics.
- Verify checked/unchecked behavior and accessible label association.

### Privacy copy claims optional analytics without a consent mechanism

Confirmed legal copy says optional analytics cookies are used. No analytics integration or consent UI was identified in the inspected application source.

Required immediate correction:

- If optional analytics are not active, state that accurately instead of claiming they are used.
- If analytics are enabled later, implement consent before loading non-essential analytics where legally required.

## Payment claim requiring verification, not assumption

Grokbot’s statement that checkout “isn’t wired” is not fully accurate at source level:

- `/tarot/pricing` calls `/api/billing/checkout` and redirects when the API returns a Stripe URL.
- The same page incorrectly displays “Stripe Checkout will be wired in the billing workstream” after selection.

Treat production payment readiness as **unverified**, not broken or working, until the full sandbox flow is exercised:

1. authenticated checkout creation;
2. correct Stripe product/price mapping;
3. success and cancel returns;
4. signed webhook delivery and replay safety;
5. entitlement grant;
6. failed-payment behavior;
7. no live charge during testing.

Remove the stale “will be wired” sentence only after the real flow is proven, or replace active upgrade CTAs with a truthful unavailable state.

## Corrected/stale Grokbot claim

The current production `/pricing` page does **not** display the old four-tier paid grid. It currently states that only the free Birth Chart and invite-only Love Blueprint are available and that other premium reports are not yet offered. Preserve this honest behavior.

The paid mismatch exists in the homepage `Services` cards, header reports dropdown, and `/tarot/pricing` experience—not the current top-level `/pricing` page.

## Recommended delivery order

### PR 1 — emergency account-route hotfix

Only the `/profile`/`/dashboard` routing correction and regression tests. Deploy and verify immediately.

### PR 2 — Love Blueprint public paid launch

Remove the invite/allowlist gate without weakening payment or launch controls; update all related UI/legal copy and prove the Stripe/report pipeline in test mode.

### PR 3 — auth/account UX

Authenticated login redirect, stable header auth state, mobile menu accessibility, signed-out tarot-history CTA.

### PR 4 — truth-in-marketing and navigation

Remove or relabel unavailable offers, eliminate fake newsletter success, correct footer links/mounting, correct moon checkbox label, add favicon, and correct inaccurate analytics copy.

### PR 5 — provider-dependent work

Password recovery, newsletter delivery, and any checkout/product activation only after provider/product decisions and end-to-end sandbox verification.

## Release evidence required for every PR

- Failing regression test observed before implementation.
- Focused tests pass.
- Configured full test suite passes.
- Main and test TypeScript checks pass.
- Production build passes.
- `npm audit` has no unresolved high/critical vulnerabilities.
- Exact commit deployed to staging.
- Automated route checks plus targeted browser evidence.
- Production read-back after merge/deploy.
