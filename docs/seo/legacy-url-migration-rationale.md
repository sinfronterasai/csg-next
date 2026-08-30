# Legacy URL Migration Rationale

Canonical information architecture and evidence for every legacy production URL
(402 paths in the 2026-08-30 production sitemap) ahead of the cosmicspiritguide.com
custom-domain cutover. Machine-readable companion: legacy-url-migration-manifest.json

## Disposition vocabulary
- KEEP_AND_REBUILD: rebuild on csg-next as an indexable, canonical page with real, distinct value
- REFRESH_AND_MIGRATE: real editorial/tool page that resolves on csg-next; refresh metadata/canonical
- MERGE_AND_301: duplicate/ordering variant; permanent 301 to the single canonical destination
- 301_EQUIVALENT: legacy URL with a genuinely equivalent new destination (tool/hub/page); 301 to it
- RETIRE_410: no demand, no unique value, unlaunched feature, or fabricated/duplicate content; 410 + noindex
- NOINDEX_UTILITY: useful to signed-in users but not a search landing page; excluded from sitemap, noindex

## Disposition counts (generated)
See legacy-url-migration-manifest.json field disposition. Summary after evidence reconciliation:
- KEEP_AND_REBUILD: 308 (incl 144 astrology, 66 compatibility, 12 zodiac, 78 tarot, 11 blog, trust pages, hub)
- REFRESH_AND_MIGRATE: 2 (birth-chart, constellations - real tools that resolve on csg-next)
- MERGE_AND_301: 8 (5 compatibility non-canonical orderings + 3 date-suffixed blog twins)
- 301_EQUIVALENT: 14 (blog promos/guides 301 to tarot, compatibility, birth-chart, or root)
- RETIRE_410: 72 (31 transits, 13 horoscope, 10 unbacked blog posts, 18 other unlaunched/dead routes)
- NOINDEX_UTILITY: 5 (login, reset-password, profile, my-chart, reports)

## Blog editorial (Workstream C) - evidence-backed
Sanity production (project kicslgfz, dataset production) was probed live. Only 11 blogPost docs
exist; 10 of the 38 legacy blog slugs match a real Sanity slug and are kept (KEEP_AND_REBUILD).
The remaining 28 had NO Sanity source and were re-dispositioned:
- 3 MERGE_AND_301: date-suffixed duplicate twins of a canonical post (e.g. free-moon-2 -> free-moon-1)
- 14 301_EQUIVALENT: promo/guide landings whose equivalent is a live tool or hub (tarot, compatibility,
  birth-chart, root)
- 10 RETIRE_410: no Sanity source and no equivalent launch route (off-mission, unlaunched features
  like numerology/synastry, or generic AI-spirituality editorials)
Substantive prose refreshes are NOT mass-written here; they become briefs for the n8n
writer to editor to judge pipeline per the brief.

## Programmatic families (Workstream B) - anti-slop contract
- astrology/sun/moon (144): distinct natal Sun/Moon blend intent; each page derives real
  explanation/ruler/element/modality from src/lib/astrology SIGNS. Not a token swap of compatibility
- compatibility/pair (66 canonical): love-compatibility intent; canonical alphabetical pair
  ordering; reversed slugs 301 to canonical (no duplicate)
- zodiac/sign (12): per-sign traits from SIGNS
- transits (31) and horoscope (13): RETIRE_410. No real computed ephemeris or dated data served;
  the brief forbids fabricating daily/transit pages. src/lib/transit.ts is the future source
All programmatic pages use dynamicParams=false plus generateStaticParams, so invalid signs/planets
return 404 (never 200). Internal links connect siblings (opposite sign, compatible signs, hubs).

## Redirect and indexing safety
- No catch-all redirect to root; unknown legacy paths are not force-routed
- 301 targets are semantically equivalent canonical destinations, never an unrelated homepage fallback
  except the 4 unlaunched-commercial merges (credits/pricing/services/subscription to hub) which the
  brief explicitly authorizes as the single commercial hub
- 410 responses carry X-Robots-Tag: noindex
- Preview hosts (csg-next.onrender.com) receive X-Robots-Tag: noindex, nofollow; production canonical
  is absolute on https://cosmicspiritguide.com

## Prohibited side effects (verification)
- DNS, custom-domain, and Render config: NOT changed
- Production n8n workflows and production DB schema: NOT changed
- R6.5 PR number 9: NOT modified or merged (this branch is feat/content-seo-cutover-parity-v2, based on f0bd970)
- No reset/clean/stash/discard of any existing work
