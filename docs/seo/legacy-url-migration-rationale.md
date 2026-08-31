# Legacy URL Migration Rationale

Canonical information architecture and evidence for every legacy production URL
ahead of the cosmicspiritguide.com custom-domain cutover. Machine-readable companion:
`legacy-url-migration-manifest.json` (regenerated deterministically from
`docs/seo/evidence/route-parity-audit.csv` via `scripts/seo/build-manifest.mjs`).

## Disposition vocabulary
- KEEP_AND_REBUILD: rebuild on csg-next as an indexable, canonical page with real, distinct value
- REFRESH_AND_MIGRATE: real editorial/tool page that resolves on csg-next; refresh metadata/canonical
- MERGE_AND_301: duplicate/ordering variant; permanent 301 to the single canonical destination
- 301_EQUIVALENT: legacy URL with a genuinely equivalent new destination (tool/hub/page); 301 to it
- RETIRE_410: no demand, no unique value, unlaunched feature, or fabricated/duplicate content; 410 + noindex
- NOINDEX_UTILITY: useful to signed-in users but not a search landing page; excluded from sitemap, noindex

## Disposition counts (generated, current)
From `legacy-url-migration-manifest.json` (409 rows, 0 duplicate oldPaths):
- KEEP_AND_REBUILD: 317
- REFRESH_AND_MIGRATE: 2 (birth-chart, constellations — real tools that resolve on csg-next)
- MERGE_AND_301: 4 (non-canonical compatibility orderings only — alphabetical 301 to canonical pair)
- 301_EQUIVALENT: 13 (blog promos/guides 301 to tarot, compatibility, or birth-chart — never root)
- RETIRE_410: 68 (31 transits, 13 horoscope, blog posts with no equivalent, unlaunched/dead routes)
- NOINDEX_UTILITY: 5 (login, reset-password, profile, my-chart, reports)

## Blog editorial — evidence-backed (no mass article writing)
Sanity production (project kicslgfz, dataset production) was probed live. Only 11 `blogPost`
docs exist; 10 of the 38 legacy blog slugs match a real Sanity slug and are kept. The remaining
28 had NO Sanity source and were re-dispositioned:
- MERGE_AND_301: date-suffixed duplicate twins of a canonical post (free-moon-2 → free-moon-1;
  twin-flame test-1/-2 → twin-flame-vs-soulmate)
- 301_EQUIVALENT: promo/guide landings whose equivalent is a live tool or hub (tarot, compatibility,
  birth-chart). NO redirect goes to the homepage; B7 forbids unrelated root redirects.
- RETIRE_410: no Sanity source and no equivalent launch route (off-mission, unlaunched features,
  or generic AI-spirituality editorials)
Substantive prose refreshes are NOT mass-written here; they become briefs for the n8n
writer→editor→judge pipeline per the governing editorial queue.

## Programmatic families — anti-slop / editorial hold
Per the editorial queue (section C), the high-volume programmatic families are NOT indexed until
curated pair-specific value is approved:
- astrology/[sun]/[moon] (144) and compatibility/[pair] (66): rendered `noindex` and EXCLUDED from
  the sitemap. Token-swapped reused sign text does not satisfy the no-slop contract; they remain
  `noindex`/absent until an approved content pass exists. Reordered sign paragraphs are explicitly
  NOT treated as uniqueness.
- zodiac/[sign] (12): curated, distinct per sign; indexable.
- transits (31) and horoscope (13): RETIRE_410. No real computed ephemeris or dated data served;
  the brief forbids fabricating daily/transit pages.
- tarot/[slug] (78): indexable where card-specific content is distinct (conditional keep per queue).

All programmatic pages use `dynamicParams=false` plus `generateStaticParams`, so invalid
signs/planets return 404 (never 200).

## Redirect and indexing safety
- No catch-all redirect to root; unknown legacy paths are not force-routed.
- 301 targets are semantically equivalent canonical destinations, never an unrelated homepage fallback.
  (The earlier 4 unlaunched-commercial → root merges were removed per review B7; those routes are now
  RETIRE_410 until an authorized commercial hub exists.)
- 410 responses carry `X-Robots-Tag: noindex`.
- Preview hosts (csg-next.onrender.com, localhost) receive `X-Robots-Tag: noindex, nofollow`;
  production absolute canonical is always `https://cosmicspiritguide.com/...` regardless of the
  requesting host (B9).

## Sanity publication query contract (B11)
Public blog queries in `src/lib/blog/queries.ts` now FAIL CLOSED:
- require `status == "published"` AND `review.status == "approved"` (independent editorial approval);
- require defined, non-empty `slug`/`title`/`content`/`publishedAt`;
- exclude test/system documents (`slug.current !match "^__"`).
No production Sanity data was mutated in this task. The `blogPost` schema currently has a single
lifecycle field and no independent approval record; until that schema is extended (separate approval),
the query predicate enforces the approval requirement at the query layer. This guarantees zero
un-approved, draft, review, rejected, or test documents are visible via list, latest, slug,
static params, or sitemap.

## DEFERRED / APPROVAL-REQUIRED (not claimed ready)
- LEGAL_CONTENT_APPROVAL_REQUIRED: `/privacy`, `/terms`, `/contact` are reachable but `noindex` and
  EXCLUDED from the sitemap. They contain no invented legal/business/contact/email facts and no
  visible placeholders. Final legal copy requires verified business details and owner approval before
  these routes are indexed. About page is informational only (verified product facts) and remains indexable.
- Blog content remains `HOLD` per the editorial queue until `review.status == approved` is enforced
  and each article passes the hard gates. No null-review doc leaks to the public sitemap.

## Prohibited side effects (verification)
- DNS, custom-domain, and Render config: NOT changed.
- Production n8n workflows and production DB/schema: NOT changed (Sanity queries only tightened, no mutation).
- R6.5 PR number 9: NOT modified or merged (this branch is `feat/content-seo-cutover-parity-fix`,
  based on exact SHA 40f287cd123f89ad190ec36d0c7bba6e52228759).
- No reset/clean/stash/discard of any existing work; the prior commits/worktrees are preserved.
