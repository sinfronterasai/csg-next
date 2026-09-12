# PREMIUM REPORTS — BUILD & CONTENT PLAN (for PIKE)

Author: John (content-manager)
Date: 2026-08-17
Companion docs: report-product-design.md (product spec), product/reports-page-design.md
  (nav + page IA), brand-kit.md (visual system)
Sample reviewed: report-MASTER-premium-1776957160735-fjvp7r.pdf (the thing we are
  REPLACING — see §0 for why it is not premium).

==================================================================
0. WHY THE CURRENT SAMPLE IS NOT PREMIUM  (read first, PIKE)
==================================================================
The MASTER PDF we were shown fails on three axes. Our new system must fix all three:

A. FRANKENSTEIN STRUCTURE. One file mixes a natal chart (Ethan), a SYNASTRY/
   relationship section about a SECOND person ("Valeria Guadalupe Rios Gonzales"),
   an "Extended Transit Forecast", an "Annual Forecast", and "Karmic & Shadow Work".
   No single report should silently merge two people's data. Each report type is its
   OWN artifact (see §2). The Master becomes a paid BUNDLE that assembles the separate
   artifacts — it never re-computes or mushes them together.

B. BOILERPLATE PADDING (the #1 quality killer). Verbatim repeats in the sample:
   - "With time and effort, you can develop a more harmonious and balanced
      relationship, allowing you to navigate life's challenges with greater ease
      and understanding."  -> appears 5x
   - "navigate life's challenges with greater ease and understanding" -> 6x
   - Every relationship dimension ends with the same 4-line "Strengths / Areas for
      growth / Long-term implications" template regardless of the actual score.
   RULE: zero boilerplate. Every paragraph must cite a SPECIFIC planet, degree, house,
   aspect, or date. If a sentence could appear in anyone's report, it is cut.

C. NO VISUAL DESIGN. It is a text dump with an ASCII chart wheel on Void-ish bg.
   "Premium, sought-after" means a designed artifact: celestial gradients, Cinzel
   headers, gold rules, real chart wheels rendered as vector, per-section dividers
   using our 14 cosmic images. See §3.

==================================================================
1. PRODUCT PRINCIPLES (quality bar — non-negotiable)
==================================================================
1. ONE BIRTH DATA, MANY REPORTS. Saved natal chart ("My Chart") feeds every report.
   Never re-ask DOB/time/place. (report-product-design PART 3 rule 1)
2. SEPARATE ARTIFACTS, NOT A BLOB. Natal, Transit, Synastry, Vocation, Shadow are
   distinct generators. The "Master / Full Cosmic Profile" is an ASSEMBLY of the
   individual artifacts at a bundle price — never one merged prompt.
3. PRECISION OVER FLUFF. Every claim names the exact celestial object + degree +
   house + aspect + orb. "Your Sun at 19° Pisces in the 1st" not "your Pisces energy".
4. ZERO BOILERPLATE. Banned phrases list (auto-lint in CI): "with time and effort",
   "navigate life's challenges with greater ease", "the universe is calling upon you",
   "a journey of self-discovery", "embrace the challenges and opportunities". Any
   generated paragraph containing a banned phrase is REJECTED by the quality gate.
5. DETERMINISTIC + VERIFIABLE. Computed values (positions, aspects, scores) come from
   the ephemeris + aspect engine, NOT from an LLM. The LLM only writes the
   INTERPRETIVE prose around verified facts. Facts are asserted; prose is decorated.
6. QUALITY GATE BEFORE DELIVERY. No report reaches a customer until it passes the
   gate in §5 (automated lint + editor human review for paid tiers).
7. EMPOWERMENT, NOT FEAR. Brand-kit voice: "the stars suggest, you decide." No
   fear-mongering, no guaranteed-outcome claims.

==================================================================
2. REPORT ARTIFACTS (what PIKE builds — separate generators)
==================================================================
Each is its own module returning structured data -> rendered by the shared template (§3).

R1. NATAL (BIRTH) CHART REPORT  [FREE gateway]
    Data: 10 planets (sign/house/degree/retro), ASC/MC, Nodes, Chiron, Part of Fortune,
      dominant element/modality, chart patterns (T-square/stellium/etc), aspect grid.
    Write-up: per-planet essence (strengths/opportunities/challenges), house themes,
      pattern interpretation, element/modality balance. ~6-10 pp.
    Upsell footer -> R2/R3/R4.

R2. YEARLY TRANSIT FORECAST  [$49]
    Data: 12 months of major transits (Sun/Mer/Venus/Mars/Jup/Sat) to natal points,
      retrogrades, eclipse seasons touching natal angles, topic scores per month
      (seeded, deterministic). Key dates list. .ics export of key dates.
    Write-up: 12-month timeline + per-month planetary influence / key dates /
      opportunities / watch-outs. ~14-20 pp.
    Upsell -> Zoom.

R3. SYNASTRY LOVE REPORT  [$65]
    Data: 7 planet-pair overlays (Sun/Moon/Merc/Venus/Mars/ASC/Node) -> aspect+orb+
      house overlay; composite themes; overall compatibility score (seeded).
    Write-up: per-pair dynamic (strengths / friction / bridge) + 5-dimension scores
      (emotional/communication/spiritual/stability/physical). IMPORTANT: this is the
      ONLY report with two people — keep Person A and Person B clearly labeled
      EVERYWHERE. No leaking Person B's name into a "natal" report. ~10-14 pp.

R4. VOCATION & WEALTH MAP  [$55]
    Data: MC sign + ruler aspects -> career archetype; 2nd-house planets -> money
      style; 10th-house -> public role; Saturn/Jupiter synthesis -> timing; favorable
      career-transit windows next 24 mo.
    Write-up: vocation archetype + wealth style + best launch windows (tied to R2).
      ~8-12 pp.

R5. KARMIC & SHADOW WORK  [add-on, $19 or bundle-only]
    Data: nodal axis interpretation, south-node patterns, hidden strengths, release
      list, 3-5 journaling exercises grounded in THEIR nodes (not generic).
    Write-up: specific to their nodal axis + relevant aspects. Banned: generic
      "journal about your emotions" with no tie to their chart.

R6. TAROT SPREADS  [1 & 3-card FREE; Celtic Cross/Relationship/Career $4.99]
    (Already specced in report-product-design §5; PIKE renders these as a saveable
    "My Readings" page, not necessarily PDF.)

BUNDLE: "FULL COSMIC PROFILE" (Master replacement) = R1+R2+R3+R4 [rec $149]
    Assembly of the four artifacts + a 1-page personalized index/cover. NOT a merged
    prompt. Each section retains its own quality gate pass.

==================================================================
3. VISUAL / RENDER SPEC  (premium look — PIKE + design)
==================================================================
OUTPUT FORMAT: HTML rendered to PDF (Paged.js / Prince / WeasyPrint) so it is
  responsive on web AND downloadable. Vector chart wheels (SVG), not ASCII.

DESIGN SYSTEM (from brand-kit.md):
- Background: Void Black #03000A -> Deep Indigo #1E1B4B -> Nebula Violet #7C3AED
  gradient (subtle, space-like). Never pure white.
- Text: Star White #FFFFFF headings (Cinzel), Moon Grey #D1D5DB body (Inter/IBM Plex).
- Accent rules: Solar Gold #E8C87E (section dividers, key CTAs, degree marks).
  Aurora Teal #2DD4BF for "live/instant" + transit indicators.
- Typography: Cinzel for H1/H2/section titles (tracked-out, sentence case); body sans
  16-18px, line-height 1.6. NEVER Cinzel for paragraphs.

PAGE COMPONENTS (reusable, per report):
1. COVER: "Prepared for {First Name}" + "Generated {date}" + report title in Cinzel +
   compass-rose or eclipse art (reuse venice_image_1786952985191 / ...2989458) +
   a one-line personal thesis (specific, not "the universe calls you").
2. CHART WHEEL (SVG): 360° wheel, house cusps, planet glyphs at exact degrees,
   retrograde marks, aspect lines (conj/opp/trine/sq/sextile color-coded). This is the
   hero visual — must look like a real astrology app, not ASCII.
3. DATA TABLES: "Planets in Houses" one row per planet [glyph][sign@house, deg]
   [retro?] + 1-line essence. Aspect grid as a real matrix.
4. SECTION DIVIDERS: gold rule + Cinzel title + a cosmic image band (reuse the 14
   alt-tagged images as full-bleed or framed dividers).
5. SCORE BANDS: for Synastry/Transit, render dimension scores as gold/teal meters
   (not just "59%"). Must show the SPECIFIC driver of the score.
6. CALLOUTS: "Key Date" cards, "Watch-out" teasers, "Action" prompts — short, specific.
7. FOOTER: brand sign-off "Stay aligned — CSG", privacy line, upsell CTAs.

IMAGE ASSET MAP (reuse, already alt-tagged):
  Cover/Natal ...... compass rose (...2985191) or eclipse (...2989458)
  Transit ........... August lunar calendar (...2953999 / ...2934703)
  Synastry .......... Aries journal (...2938424) or lavender moon (...2981438)
  Vocation .......... moon+sun seedlings (...2946062)
  Shadow/Node ....... waning-gibbous moon phase art (...2965749) or parchment (...2973415)
  Tarot ............. full moon ocean + singing bowl (...2949931) or lake (...2941997)

==================================================================
4. CONTENT PIPELINE (how text is produced + gated)
==================================================================
We already run an n8n pipeline (writers -> editors -> judges grade) for BLOG.
Reports use the SAME quality-gated pattern, with one hard difference:
  FACTS are computed by code (ephemeris + aspect engine), not written by a model.
  Only the INTERPRETIVE prose is model-generated, then graded.

FLOW per report:
  1. Compute: ephemeris + aspect engine -> verified JSON (positions, aspects, scores,
     dates). This JSON is the single source of truth.
  2. Generate prose: model receives the VERIFIED JSON + a strict brief (tone, banned
     phrases, must-cite specifics, length per section). Output = Portable Text / HTML.
  3. Lint (automated, blocks delivery): banned-phrase scan, "specificity check"
     (does each paragraph name >=1 celestial fact from the JSON?), duplicate-paragraph
     detection, length bounds. Fail -> back to step 2.
  4. Grade (judges, like blog): against a reportQualityBar (see §5). Paid tiers
     (R2/R3/R4/bundle) require a HUMAN EDITOR pass before delivery; free R1 may ship
     on automated lint + sample audit.
  5. Render: passed content -> HTML template (§3) -> PDF + on-page view.
  6. Deliver: Stripe webhook -> compute (if not cached) -> gate -> render -> email +
     save to My Chart + Dispatch opt-in.

PIKE owns steps 1, 3 (lint hooks), 5, 6. John owns the briefs + qualityBar + editor
review roster. n8n team owns step 2/4 generation+grading nodes (reuse blog pipeline).

==================================================================
5. QUALITY BAR  (the "utmost quality" gate — John's call, PIKE enforces)
==================================================================
A report is APPROVED only if ALL hold:
- [ ] Facts match computed JSON exactly (no hallucinated degrees/signs/houses).
- [ ] Zero banned phrases (automated lint, hard fail).
- [ ] Zero duplicated paragraphs/sentences (diff check vs other reports for same user).
- [ ] Every interpretive paragraph cites >=1 specific celestial fact (Sun@19°Pisces/1st,
      Saturn sq MC, etc). "Your Pisces nature" with no anchor = FAIL.
- [ ] Scores (synastry/transit) show their driver, not just a number.
- [ ] Voice = empowering, precise, second-person; no fear-mongering; no guaranteed
      outcome.
- [ ] Visual: rendered template passes design check (Cinzel headers, gold rules, dark
      bg, vector wheel, no ASCII).
- [ ] Length within bounds per report type (§2).
- [ ] Human editor sign-off for paid tiers.

"SOUGHT-AFTER" LEVERS (make people talk about it):
- Personalized cover + real chart wheel they'll screenshot/share (share card).
- A surprising, specific insight on page 1 ("Your chart ruler Mercury is retrograde in
  the 9th — your biggest growth edge is trusting lived experience over theory").
- Print-quality PDF (people keep these).
- A "share with partner" link for Synastry (virality).
- Consistent, dignified voice — the opposite of the padded sample.

==================================================================
6. DECISIONS — RESOLVED (John, 2026-08-17)
==================================================================
D1. Render engine: Paged.js (free, browser-based, great dev speed + CSS control).
    Use for v1. If print-fidelity QA fails, upgrade to PrinceXML later. WeasyPrint
    rejected (weaker CSS, won't hit the premium look).
D2. Chart wheel: IN-HOUSE SVG. Full brand control, exact degrees, color-coded aspects.
    No third-party chart library.
D3. Bundle price: FULL COSMIC PROFILE = $89 (was $149). Complete Guide (adds Shadow) =
    $99. See product/reports-pricing.md for full ladder + à-la-carte math.
D4. Shadow Work (R5): STANDALONE $19 ADD-ON AND included in the Complete Guide bundle.
D5. Free Natal (R1): ships on automated lint + bannered "AI-draft, editor-sampled"
    note; weekly editor sample-audit of 5% of free reports. Paid tiers = full editor pass.
D6. Tarot (R6): WEB-ONLY "My Readings" save (no PDF). Matches blog spec; keeps tarot
    light and re-drawable.

FINAL VALUE LADDER (enforced in /reports + Stripe):
  Natal Report ............ $0
  Transit Forecast ........ $39
  Vocation & Wealth ....... $39
  Synastry ................ $49
  Shadow Work ............. $19
  Tarot 1/PPF ............. $0   |  Celtic/Relationship/Career ... $4.99 each
  Full Cosmic Profile ..... $89  (Transit+Vocation+Synastry+Natal; à la carte $127, save 30%)
  Complete Guide .......... $99  (+ Shadow; à la carte $146, save 32%)
  Live Zoom ............... $120 (anchor)

==================================================================
==================================================================
[ ] Ephemeris + aspect engine module (reuse Birth Chart tool's approach) -> verified JSON
[ ] Separate generators R1-R5 (+ bundle assembler) returning structured data
[ ] Banned-phrase + specificity linter (CI gate, hard fail)
[ ] HTML->PDF render template with brand system + SVG chart wheel
[ ] n8n nodes: prose gen (JSON-in) + judge grading against reportQualityBar
[ ] Stripe one-time checkout + webhook -> compute -> gate -> render -> email + My Chart
[ ] /reports route + per-purchase DB record (report-product-design PART 3 rule 8)
[ ] Image asset wiring (14 cosmic images, alt text done)
[ ] Editor review queue for paid tiers
==================================================================
