# COSMIC SPIRIT GUIDE — CONTENT PIPELINE HANDOFF

## PRODUCTION FLOW
n8n workflow: writers -> editors -> judges (grade) -> [FINAL PHASE: write to Sanity] -> blog
- JOHN (content-manager): owns DIRECTION + FLOW. Writes editorial `brief`s (strategy,
  keyword, intent, angle, required sections, quality bar). Reviews graded output. Does
  NOT write the articles.
- n8n WRITERS/EDITORS/JUDGES: execute the briefs. Judge grades against `qualityBar`.
- ALEX (Dev): builds the site + technical SEO on cosmicspiritguide.com; wires /blog route
  to read Sanity via GROQ.
- JOHN (new charge): owns the Sanity CMS blog structure the n8n final phase pipes into
  (see sanity-studio/).

## ROLES
- John: strategy, briefs, calendar, quality bar, review, channel direction, Sanity schema.
- Alex: site build, SEO, /blog route, sitemap, analytics.
- n8n: content production + grading (writers/editors/judges).

## PROTOCOL
1. John writes a `brief` -> sanity-studio schema `brief`, seeded from blog/briefs/*.md.
2. n8n pulls brief by slug, produces `post`, links back to brief, writes review.grade.
3. John reviews graded posts (Sanity desk "Awaiting Approval") -> flips `approved`.
4. Alex's /blog route only publishes `post` where review.status == "approved".

## FILE MAP
- sanity-studio/        -> Sanity Studio config + schema (brief, post, category, author).
  - sanity-studio/README.md -> n8n -> Sanity mutation mapping (final phase spec).
- blog/briefs/          -> John's editorial briefs (seed content for `brief` docs).
- editorial-calendar.md -> 12-week plan; each post maps to a brief + a tool CTA.
- seo-spec-for-alex.md  -> Alex's technical SEO contract (titles, meta, schema, blog hub).
- dev-tasks/README.md   -> Alex's build backlog (D1-D6).

## STATUS BOARD
| ID | Task | Owner | Status |
|----|------|-------|--------|
| C1 | 12-week editorial calendar | John | DONE (editorial-calendar.md) |
| C2 | Technical SEO spec | John | DONE (seo-spec-for-alex.md) |
| C3 | Brief: birth chart guide | John | DONE (blog/briefs/03-...) |
| C4 | Brief: mercury retrograde 2026 | John | DONE (blog/briefs/02-...) |
| C5 | Brief: tarot card meanings | John | DONE (blog/briefs/01-...) |
| C6 | Sanity Studio schema + config | John | DONE (sanity-studio/) |
| C7 | Seed 6 categories + 1 author in Sanity | John/Alex | TODO (needs project) |
| C8 | n8n final phase -> Sanity mutation | n8n/John | IN PROGRESS (spec in README) |
| D1 | Deploy to cosmicspiritguide.com + 301s | Alex | TODO |
| D2 | Unique title tags + meta | Alex | TODO |
| D3 | /blog route reads Sanity (GROQ) | Alex | TODO |
| D4 | JSON-LD schema | Alex | TODO |
| D5 | Sitemap + Search Console + analytics | Alex | TODO |
| D6 | Tool-page copy blocks | Alex | TODO |
| R1 | Server-side report dispatcher to production n8n | PIKE | CODE VERIFIED — final implementation on origin/main `db25c36`; live synthetic request fails closed as `dispatch_failed` pending Render config diagnosis |
| R2 | Authenticated/idempotent pipeline callback API | PIKE | CODE VERIFIED — callback, atomic correlation, duplicate/conflict handling, immutable snapshots and tests shipped through `db25c36` |
| R3 | One-time paid report checkout, Stripe verification, editor decision and delivery gates | PIKE | CODE VERIFIED — product-specific `report_orders`, payment integrity, atomic retry and editor gates shipped; purchases remain disabled |
| R4 | Synthetic app → n8n → callback E2E and remote commit | PIKE/John | BLOCKED — superseded by content-quality remediation; Render round trip remains required after R5–R9 |
| R5 | VerifiedFactsV2 normalized ledger + report-specific schemas/fixtures | PIKE | TODO — implement from `product/reports/PIKE-REPORT-QUALITY-REMEDIATION-BRIEF.md` |
| R6 | n8n narrative writer + exact hard gates + per-section judge (`narrativeDepth`) | PIKE | TODO — BLOCKED-BY R5 |
| R7 | Regenerate and quality-approve seven component reports across fixture corpus | PIKE/John | TODO — BLOCKED-BY R5,R6 |
| R8 | Full Cosmic manifest-driven assembly from approved component versions | PIKE | TODO — BLOCKED-BY R7 |
| R9 | Complete app/PDF narrative + visual QA and authenticated production round trip | PIKE/John | TODO — BLOCKED-BY R7,R8; purchases/domain remain disabled |

### REPORT PIPELINE REVIEW — 2026-08-25

- Final reviewed app commit: `db25c366d158407d3cb6ab5fcdf4988dbc0f7231` on `origin/main`.
- PIKE verification: 255 node tests + 29 DOM tests, TypeScript clean, Next production build green, `npm audit` zero vulnerabilities, migration idempotent.
- Production DB migration applied; `report_orders` and pipeline fields/constraints verified.
- Direct Render host: `POST https://csg-next.onrender.com/api/reports/pipeline-complete` returns 401 without token (route deployed and auth enforced).
- Public custom domain: `POST https://cosmicspiritguide.com/api/reports/pipeline-complete` returns 405 because it still serves the old Render service.
- Disposable synthetic live test created user 159/chart 22/reading 634; registration and chart save passed, report dispatch returned 502 and reading became `dispatch_failed`. PIKE deleted all synthetic rows and verified zero remain.
- PBX n8n health remains HTTP 200 and report-generate webhook remains publicly reachable.
- Remaining launch work is infrastructure: inspect/set the five Render server env keys, rebind apex + www to `csg-next`, and rerun the authenticated app → n8n → callback smoke into the same reading ID.
- Customer paid purchases remain disabled until R4 passes.

### REPORT CONTENT QUALITY REVIEW — 2026-08-25

- Private local gallery: `C:\Users\Ethan\cosmic-spirit-guide\report-review\index.html`.
- Synthetic authoritative profile: Maya Review, 1990-06-15 12:00, Paris; facts computed by the app's Swiss Ephemeris engine.
- All eight production n8n workflows were run sequentially through Kimi, lint/revision, judge, and authenticated private callback. No Stripe/customer records were used.
- Results: Natal `approved` (17 sections); Love Blueprint `needs_editor` (10); Vocation `needs_editor` (9); Full Cosmic `needs_editor` (3); Relationship `rejected` (unrendered missing-fact placeholders); Love Timing `rejected` (placeholder/missing interpretation); Yearly Transit `rejected` (duplicate-content lint); Karmic & Shadow `rejected` (false Uranus dignity claim).
- PBX callback allowlist was restored to its original production host, the temporary Tailscale Funnel was disabled, and Asterisk remained at zero active calls during the test.
- Do not cut over or enable purchases until rejected workflows are corrected, regenerated, and approved by John.
- Full editorial/product review and implementation order: `C:\Users\Ethan\cosmic-spirit-guide\report-review\QUALITY-REMEDIATION-PLAN.md`.
- Core finding: this is primarily a verified-facts/schema/enforcement failure, not a prose-only problem. Per-report briefs are not fully enforced at runtime; `degreeInSign`, aspects/patterns/derived points/scores/transit ledgers are incomplete; unresolved placeholders are not deterministically blocked; judge output is aggregate and overgenerous; Full Cosmic is incorrectly generated as a three-section wrapper instead of assembling approved component reports.
- Required order: normalized fact ledger + report schemas -> workflow hard gates/per-section judge -> regenerate seven components -> assemble Full Cosmic -> John/editor approval -> final app/PDF visual QA. Do not hand-edit the current samples into deliverables.
- Narrative-first standard is locked: facts are evidence, but every customer report must tell a cohesive, chart-specific story about gifts, tensions, developmental path, timing, choices, and practical next steps. Cold fact dumps and unsupported invented biography both fail.
- PIKE's build-ready remediation brief: `product/reports/PIKE-REPORT-QUALITY-REMEDIATION-BRIEF.md`.

## OPEN QUESTIONS
- Sanity project ID (kicslgfz — VERIFIED reachable, HTTP 401 pre-auth). Needs `npx sanity login` (owner, browser OAuth) + n8n write token from Sanity API Tokens page.
- n8n: does the final phase exist as a stub yet, or build from README mapping?
- Markdown -> Portable Text transform node: confirm tool/method in n8n.
