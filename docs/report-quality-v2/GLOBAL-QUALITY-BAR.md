# GLOBAL REPORT QUALITY BAR — judge rubric, banned phrases, tone rules (all 12)

Author: John (content-manager)  Date: 2026-08-17
This is the `reportQualityBar` the n8n judge node grades against and the CI linters
enforce. A report ships only when ALL hard gates pass. Paid tiers additionally require a
human editor pass. Companion to global-generation-brief.md (voice) and the 12 per-report
briefs.

==================================================================
PART 1 — HARD GATES (binary pass/fail; any FAIL blocks delivery)
==================================================================
G1 FACTUAL FIDELITY. Every celestial claim matches the verified JSON exactly. No
   invented degrees/signs/houses/aspects/dates/scores. (Fail = hallucination.)
G2 NO BANNED PHRASES. Zero occurrences of the Part-3 blocklist (case-insensitive).
G3 SPECIFICITY. Every interpretive paragraph cites >=1 verified fact (planet+sign+deg+
   house, or aspect+orb, or transit+date). A sentence that fits anyone's report = FAIL.
G4 NO BOILERPLATE DUPLICATION. No paragraph/section >30% text-overlap with (a) another
   section in the same report, or (b) another report for the same user.
G5 TONE COMPLIANCE. No Part-4 tone violations (fatalism, guarantee, fear, surveillance,
   medical/legal advice, relationship verdicts).
G6 STRUCTURE + NARRATIVE ARC. Correct section set for the report type; present + in order;
   two-person reports render BOTH wheels and label A/B throughout. The report opens with an
   earned thesis, develops connected themes, integrates chart tensions, and lands with a
   chart-bound practical path. A disconnected placement list or cold fact dump fails.
G7 LENGTH. Section within its word bound; report within its page target (index rule) —
   met by sections, not padding.
G8 AGE/CONSENT. Romantic content 18+; two-person data present + consented.

==================================================================
PART 2 — SCORED DIMENSIONS (judge 1-5 each; ship threshold noted)
==================================================================
Grade each 1-5 with a one-line justification. PAID tier: every dimension >=4, plus
editor sign-off. FREE tier (Natal): automated gates + lint pass; 5% weekly editor audit;
no single dimension <3.
  D1 Precision - how specific and well-anchored the prose is (degrees/houses/dates).
  D2 Insight density - ratio of real, useful insight to filler. No fluff sentences.
  D3 Voice fit - matches house style (mystical-grounded, empowering, warm, human).
  D4 Empowerment - reader leaves feeling capable; challenges framed as workable.
  D5 Personalization - reads like it was written for THIS chart, not a template.
  D6 Clarity - clear, well-structured, no jargon-dump; celestial terms briefly explained.
  D7 Cohesion - sections connect; two-person dynamics read fairly to both people.
  D8 Narrative depth - verified facts become a unique path-level story with tensions,
      synthesis, agency, and practical next steps; not a data dump or invented biography.

==================================================================
PART 3 — BANNED PHRASES (exact-match blocklist; hard fail)
==================================================================
(Seeded from the low-quality MASTER sample + brand DON'Ts. Case-insensitive substring.)
- with time and effort
- navigate life's challenges with greater ease
- navigate the complexities of life
- the universe is calling upon you
- the universe is always guiding you
- a journey of self-discovery
- embark on this journey / embark on a journey
- embrace the challenges and opportunities
- you possess the inner wisdom
- as we embark / as we weave together
- a tapestry of energies
- deepen your connection with your emotions (generic)
- trust in the process (standalone, no fact)
- soulmate / soulmates
- twin flame (as a promise of destiny)
- destined to be together / meant to be together
- guaranteed / guarantee (any outcome)
- you will marry / you will meet the one / they will come back
- break up / you should leave / you should stay
- is he cheating / is she cheating / catch them / lying to you
- this will happen / this is your fate
- doomed / cursed / ruined by (mercury retrograde will ruin)
- past life (stated as literal fact)
- guaranteed love / guaranteed success / guaranteed money

Note: editors + PIKE can append to this list. Add the new phrase here; the CI linter
reads this file's list. A paragraph is rejected on ANY hit.

==================================================================
PART 4 — TONE RULES (violations to flag; some = hard fail, some = flag-for-editor)
==================================================================
HARD FAIL (auto-block):
- Fatalism: presenting an outcome as fixed/unavoidable.
- Guarantee: any promised outcome (love, money, return, health).
- Fear: scare framing around a planet/aspect/transit (e.g. "Saturn will destroy X").
- Surveillance/control: framing a reading as a way to monitor or expose a partner.
- Verdict: telling the reader to stay in or leave a relationship.
- Medical/clinical/legal advice or any diagnosis.
- Minors: romantic content for anyone under 18 (structural gate).
- Two-person leakage: bare "you/your" where Person A/B is ambiguous, or referencing a
  chart that is not rendered.

FLAG FOR EDITOR (human reviews, may fix rather than reject):
- Over-poetic fluff with no anchor (grandeur without a fact).
- Generic warmth with no chart tie ("you are so compassionate").
- Repetition of the same idea in different words within a section.
- Anywhere the prose could apply to "any person with this sun sign" (template smell).
- Harsh or shaming phrasing of a challenge (should be reframed empowering).

==================================================================
PART 5 — PER-SECTION SCORECARD (judge returns this JSON per section)
==================================================================
{
  "section": "<id>",
  "hardGates": {"factual": true|false, "banned": true|false, "specific": true|false,
                "dup": true|false, "tone": true|false, "structure": true|false},
  "scores": {"precision": 1-5, "insightDensity": 1-5, "voiceFit": 1-5,
             "empowerment": 1-5, "personalization": 1-5, "clarity": 1-5,
             "cohesion": 1-5, "narrativeDepth": 1-5},
  "flags": ["..."],
  "verdict": "pass" | "revise" | "reject",
  "notes": "<one paragraph>"
}
verdict pass = all hard gates true + min score threshold met. revise = a fixable flag.
reject = any hard-gate failure or unsafe tone. Judge's notes feed the editor queue.
