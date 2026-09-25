# CSG-MAINT-001 — Resolve conflicting horoscope routes

Status: RESEARCH

## Problem

The Next.js development server exits before serving pages because the repository defines overlapping route specificity for:

- `/horoscope`
- `/horoscope[[...slug]]`

Observed behavior on September 24, 2026:

`You cannot define a route with the same specificity as an optional catch-all route ("/horoscope" and "/horoscope[[...slug]]").`

## Scope

Determine one canonical routing strategy for the horoscope hub and slug behavior without changing R-016 or other growth implementations.

## Required investigation

- Inspect both route implementations and their metadata behavior.
- Determine whether `/horoscope` is the canonical hub, a slug page, or both.
- Define supported slug inputs and invalid-route behavior.
- Preserve canonical URLs, sitemap behavior, metadata, and redirects.
- Confirm whether the route family is intended for SEO, application navigation, or both.

## Acceptance criteria

- [ ] `npm run dev` remains running.
- [ ] `/` serves successfully.
- [ ] `/horoscope` serves the intended canonical page.
- [ ] Supported horoscope slug behavior is explicit and tested.
- [ ] Invalid slug behavior is explicit and tested.
- [ ] No overlapping Next.js route specificity remains.
- [ ] `npm run build` passes.
- [ ] Full test suite passes in the canonical Gate-10 environment.
- [ ] No R-016 files are changed.

## Out of scope

- R-016 exact personalized transit behavior.
- Growth experiment assignment or analytics.
- n8n changes.
- Production deployment.
