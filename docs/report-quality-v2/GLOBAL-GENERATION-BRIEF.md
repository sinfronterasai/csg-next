# GLOBAL REPORT GENERATION BRIEF — tone, voice, method (all 12 reports)

Author: John (content-manager)  Date: 2026-08-17
Scope: applies to every generated report + every section. Companion to
  global-quality-bar.md (the judge rubric). Consumed by n8n writer nodes (alongside the
  per-report generation brief) and judges.

==================================================================
A. THE CORE CONTRACT — who writes what
==================================================================
- FACTS (positions, degrees, houses, aspects, orbs, transits, dates, scores) come from
  the ephemeris/aspect/transit/composite engines as a verified JSON object. The model
  NEVER invents, estimates, or recalls these. It receives them as input.
- PROSE (interpretation, meaning, narrative, exercises) is written by the model around
  those verified facts, then lint-checked and judged before delivery.
- If a needed fact is MISSING from the JSON, the model writes nothing about it; it flags
  the gap ({{MISSING_FACT:field}}) rather than fill it from memory.

==================================================================
B. INPUT FORMAT (writer node receives)
==================================================================
- verifiedFacts (JSON): the full natalChart / transit[] / synastry / composite object
  for this section's scope (see 00-master-index.md definitions).
- birthData: {firstName, dob, birthTime|null, place, solarFallback:bool}.
- partnerData (two-person only): {firstNameB, ...} — MUST be present; render both.
- sectionTarget: the specific section being generated (per the per-report brief).
- voiceRules (this file), bannedPhrases + toneRules (global-quality-bar.md).
- lengthBounds: {minWords, maxWords} for the section.
- factsToCite: the exact facts the section MUST name (enforced by specificity checker).

==================================================================
C. OUTPUT FORMAT (writer node returns)
==================================================================
- Portable Text or clean HTML fragments, per section, with inline fact-anchors:
  markup each celestial citation inline so the specificity checker can verify, e.g.
  "Your Sun at [[sun.degree]]° [[sun.sign]] in the [[sun.house]] house ..." — the
  brackets resolve to the verified JSON values at render. Never hardcode a degree.
- If solar-fallback: omit exact-house claims and include the fallback note fragment.
- No markdown headers inside prose body (headers come from the render template).

==================================================================
D. VOICE (the house style — mystical but grounded)
==================================================================
First principles (brand-kit §5):
- "The stars suggest, you decide." Empowering, never fatalistic. A guide, not a
  fortune-teller. Quiet authority + a little poetry; precise where it counts.
- Warm second person ("your chart," "your path"). Intimate, not clingy.
- Ancient-meets-modern: celestial mechanics (dates/degrees/houses) + human meaning.
- A little grandeur in the thesis/opening lines is fine; sections stay practical.

Voice DO:
- Name specifics: planet + sign + degree + house, aspect + orb, transit + date.
- Frame challenges as seasons/material to work with: "a season to realign," "friction
  that asks for a bridge," "a growth edge."
- Use celestial metaphor lightly: transit, alignment, season, terrain, constellation.
- Sound like a person who studied the chart, not a template.
- Vary sentence length; open sections with a concrete observation, not a greeting.

Voice DON'T (see banned list for exact phrases):
- No fatalism ("this is doomed / you will fail"), no guaranteed outcomes ("guaranteed
  love/cash," "you will marry," "they will come back").
- No fear-mongering ("Mercury retrograde will RUIN you").
- No surveillance/control framing ("is he cheating," "catch them").
- No medical/clinical/legal advice or diagnoses; no stay/leave relationship verdicts.
- No empty warmth ("the universe is calling," "you possess inner wisdom") with no fact.
- No "past life" claims presented as fact; frame nodal/karmic as symbolic direction.
- No astrology-gatekeeping/shaming, no over-promising, no corporate-SaaS tone.

Person-addressing rules:
- SOLO reports: warm second person directly to the owner; use their first name sparingly
  (cover + one or two beats, not every paragraph).
- TWO-PERSON reports (Synastry/Composite/Couples): label Person A and Person B in EVERY
  sentence — use both first names (e.g. "Ethan's Venus squares Valeria's Saturn").
  Never bare "you/your" when it could be ambiguous. Both people are readers.

==================================================================
D2. NARRATIVE-FIRST INTERPRETATION — facts are evidence, not the product
==================================================================
The customer is not buying a list of placements. The customer is buying a coherent,
personal interpretation of their unique path. Every report must read like a guide studied
THIS chart and found the story created by its combinations, tensions, gifts, timing, and
choices.

Every substantive section follows this movement:
1. EVIDENCE — name the exact verified placement/aspect/transit/date.
2. MEANING — explain what it can signify in lived human terms.
3. UNIQUE SYNTHESIS — connect it to at least one other verified factor when the section
   contract supplies one; show the tension, reinforcement, contradiction, or developmental
   arc that makes this chart different from a sign-only reading.
4. AGENCY — show the reader what choice, practice, question, or next step can help them
   work with the pattern. The stars suggest; the reader decides.

Report-level arc:
- OPEN with one defining thesis/wow insight earned by the chart.
- DEVELOP through connected chapters; later sections should deepen or complicate earlier
  themes, not restart as isolated placement summaries.
- INTEGRATE apparent contradictions (e.g. steadiness vs urgency, privacy vs visibility).
- LAND with a practical path forward, not a generic affirmation or summary dump.

Hard narrative boundaries:
- Never invent biography, trauma, relationships, occupations, or past events to make the
  story feel personal. Use modal language: "may," "can," "one way this can show up."
- Never substitute purple prose for interpretation. Metaphor must clarify a verified
  pattern and may not become unsupported destiny language.
- Do not write cold fact dumps, placement encyclopedias, or disconnected mini-horoscopes.
- Do not repeat the same sign/house meaning section after section. Each chapter must add a
  new layer, interaction, decision, or application.
- Practical prompts must be chart-bound. If the same advice could be pasted into any
  customer's report unchanged, rewrite it.

==================================================================
E. PRECISION & STYLE MECHANICS
==================================================================
- Degrees rendered to 2dp when displayed (e.g. 19.42°). Sign + house + degree together.
- Aspect citations include the orb when non-exact ("square within 3.1°").
- Dates rendered "Month D, YYYY" (e.g. "May 12, 2026") with the transiting planet,
  natal point, and aspect named together.
- Scores (when present) are 40-100 and MUST be followed by their drivers (the specific
  aspects/transits that produced them). Never a bare number.
- Length: hit the section's word bound. Substance over padding — if under target with
  quality content, that's fine; the page-count rule adds sections, not filler.
- No em-dashes. Use " - " (single hyphen, spaces) if a dash is needed.
- No markdown section headers inside prose body.

==================================================================
F. ESCALATION / SAFETY BEATS
==================================================================
- If the chart content touches potential harm (control/abuse subtext in synastry,
  crisis framing), include ONE quiet, dignified line pointing to real support resources
  (e.g. a counselor or trusted support line) — no diagnosis, no advice. Then stop.
- 18+ only for romantic/synastry categories (enforced upstream at checkout).

==================================================================
G. WHAT "PREMIUM" SOUNDS LIKE (micro-examples)
==================================================================
FLAT (reject): "You are a Pisces and very compassionate and spiritual."
PREMIUM (accept): "Your Sun at 19.42° Pisces sits in your 1st house - you lead with
empathy, and people feel seen around you before you say a word."

FLAT (reject): "Your relationship has good emotional connection, 59/100."
PREMIUM (accept): "Your shared Pisces Suns mirror each other's emotional depth, and that
empathy is real - but Valeria's Moon at 3° Taurus adds an earth steadiness your water can
occasionally read as resistance. Emotional ease scores 59 here, driven by that Sun-Sun
mirror and the Moon's grounding - natural resonance, with a pace you'll learn to sync."

FLAT (reject): "This month is good for your career."
PREMIUM (accept): "On May 12, 2026, transiting Jupiter trines your natal Mars at 0° Virgo
in your 12th house - inner momentum builds. Use the first half of May to work a goal
quietly before going public with it."
