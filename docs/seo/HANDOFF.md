# Content/Technical-SEO Catch-up — Implementation Handoff (Checkpoint 2)

Branch: `feat/content-seo-cutover-parity` | Base SHA: `bab77ba4c071028fac792182e61fc21db5876467`
Worktree: `/workspace/csg-seo-worktree` | Integration owner: Pike (free Nous provider)

## What shipped (verified)
- Centralized SEO core (no new runtime deps): `src/lib/seo/{host,jsonld,metadata,programmatic,redirects,redirect-map}.ts`
  + `src/components/seo/SeoJsonLd.tsx`. Fixes the buggy `escapeJsonLd` in `src/lib/blog/breadcrumb.ts`.
- Preview-host control: `src/middleware.ts` sets `X-Robots-Tag: noindex, nofollow` on any non-prod host
  (onrender/preview) and serves manifest-driven 301/410 for legacy cutover. Edge-safe (no fs/node).
- Programmatic families generated from REAL `src/lib/astrology` SIGNS data (deterministic, no fabrication):
  - `/zodiac/[sign]` (12 pages), `/compatibility/[pair]` (66 canonical love pairs, symmetric 301 to canonical),
    `/astrology/[sun]/[moon]` (144 natal combos). Each: unique title/desc, canonical, Organization+Breadcrumb+WebApplication JSON-LD.
- Retired families (410, no fabrication): `/transits/*` (31), `/horoscope/*` (13) via `[[...slug]]` route handlers.
- Trust/legal rebuilt: `/about`, `/contact`, `/privacy`, `/terms` with `[VERIFY]` placeholders (no legal assurances).
- Manifest-driven `sitemap.ts` (indexable only) + `robots.ts` (disallows 410 + NOINDEX_UTILITY).
- Launch allowlist (`src/lib/launch/allowlist.ts`) already enforces constraint #7 server-side; unit test locks it.

## Disposition counts (409 legacy rows)
KEEP_AND_REBUILD 316 | REFRESH_AND_MIGRATE 32 | RETIRE_410 51 | MERGE_AND_301 5 | NOINDEX_UTILITY 5
Source of truth: `docs/seo/legacy-url-migration-manifest.json` (regenerate: `node scripts/seo/build-manifest.mjs`).

## Worker registry (deleg_0125c576)
- W1 canonical IA: FAILED (subagent provider 401) — done inline by owner.
- W2 blog/Sanity: FAILED (401) — pending; Sanity probe found 11 published posts, 5 legacy slugs need refresh (see brief).
- W3 static/trust/legal: DONE `w3-static-disposition.json/.md` (integrated).
- W4 programmatic: DONE `w4-programmatic-disposition.json` (224 KEEP + 44 RETIRE_410) (integrated).
- W5 metadata/canonical/JSON-LD + host test spec: DONE `w5-*.md` (implemented as code).
- W6 redirect/acceptance harness: FAILED (401) — done inline by owner (`redirects.ts`, `redirect-map.ts`, `tests/seo/manifest.test.ts`).

## Verification evidence
- `npx tsc --noEmit`: new files clean.
- `npm run build`: GREEN (310 static pages, middleware compiled).
- `npx jest`: 579 passed, 2 skipped (80 suites).
- Live `next start` (Host: cosmicspiritguide.com): `/zodiac/aries` 200 canonical prod; `/compatibility/taurus-and-aries` 307 -> aries-and-taurus;
  `/transits/2026-08-30` 410; `/horoscope/aries` 410; `/pricing` 301 -> /; `/dashboard` 301 -> /login;
  preview host returns `x-robots-tag: noindex, nofollow`; robots.txt disallows /login /profile /reports /horoscope/*.

## Prohibited side effects (none)
- R6.5 PR #9 (`feat/mvp-quality-recovery` @ 16a7b58) NOT in this checkout, NOT modified, NOT merged.
- Parallel allowlist worktree (`pike/launch-allowlists`) untouched.
- No DNS/custom-domain, no prod n8n import, no prod DB change, no force-push, no provider switch.

## Open / for John review
1. `/transits` + `/horoscope` retired (410) for this cutover; promote later via real transit engine (src/lib/transit.ts).
2. Trust/legal pages carry `[VERIFY]` placeholders — owner to confirm claims before launch.
3. Blog/Sanity (W2) not yet executed (subagent provider outage); refresh briefs + redirect map pending.
4. Compatibility symmetric redirect is 307 (Next `redirect()` default); manifest MERGE_AND_301 for /pricing etc is true 301 via middleware.
