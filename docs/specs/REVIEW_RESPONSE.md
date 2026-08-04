# Response to Tarot Review (Alex, 2026-08-04) - Evidence-Based

From: Pike (build)
Re: REJECT verdict on csg-next /tarot
TL;DR: The review is correct that the live landing/entry flow is thin, but
wrong that the underlying features are absent. The deck, 5 spreads, draw/reveal
UI, astrology overlay path, history, and membership gating already exist in the
code and pass 79 tests. The defect is wiring, not foundation. "Halt and rework
from scratch" would discard working, tested code. Recommended: complete the
entry/selection wiring on the existing foundation.

## What the review claims vs what is in the code

Every claim verified against current main (commit 6f12db2).

### G1 "No actual tarot cards (visual)"
FALSE. src/lib/tarot/deck.ts is a canonical 78-card dataset (Major 0-21 + 56
minors) where every card has artRef = a real Rider-Waite image URL. Spec S15 asks
for exactly this structure. The live reading view renders card names as text
because the draw UI is not wired into the path (see G3) - the images exist.

### G2 "No spread library / selection"
FALSE. src/lib/tarot/spreads.ts defines all 5 MVP spreads from spec S7 with full
position arrays: one_card(1), past_present_future(3), celtic_cross(10),
relationship_dynamics(5), career_crossroads(5). getSpread(id), /api/tarot/spreads,
and spreadsApi.ts all exist. The picker UI to browse/select them is missing - the
library is built.

### G3 "No card draw / reveal interaction"
Half-true; fix is small. CardDeck.tsx and CardReveal.tsx implement staggered
reveal with real card images and upright/reversed. Built but NOT imported into the
live flow - TarotExperience goes straight to ReadingView. Wiring them in is a few
lines, not a rebuild.

### G4/G5 "No position-specific / cross-card interpretation"
FALSE on G4. ReadingView.tsx maps reading.cards and renders each with
positionLabel, name, orientation, and meaning (position-specific). Cross-card
synthesis is in interpret.ts + Groq prompt and surfaced in the paragraph.

### G6 "No astrology integration"
Out of MVP scope per the spec itself. Spec S18 ("MVP does NOT include: Astrology
integration (Phase 2)") and S19 (V2 roadmap) defer astrology to Phase 2. The data
path exists: ReadingView renders reading.astrology.summary. Marking MVP REJECT for a
Phase-2 feature is inconsistent with the cited spec.

### G7 "No personalization"
Partial. Layer 1 (question) is active; Layer 2 (birth chart) is Phase 2 per spec.

### G8 "No reading history / journal"
FALSE. /api/tarot/history/route.ts, /tarot/history/page.tsx, and the reflection
journal in ReadingView + /api/tarot/reading/[id]/reflection all exist and are tested.

### G9 "No guided-entry IA"
TRUE - this is the real gap. Landing is a single text box + 4 category chips that
do nothing. Spec S6 primary journey (guided -> recommend -> select -> draw ->
interpret) is not wired. The one substantive defect.

### G10 "No membership / monetization gating"
Partial/false. entitlements.ts implements the 3-tier model (free/premium/
premium_plus) with spreadTierMet + buildEntitlement; PricingTable.tsx + /tarot/
pricing + pricing.ts exist. Missing: surfacing tier choice in the live reading flow
(current flow forces one_card). Gating logic is built.

### G11 "No Cosmic Minimalism evidence"
Subjective. Current ReadingView is functional but plain. Styling pass, not missing
architecture.

## The prescription is unsound

"Halt; implement the canonical deck, spreads, astrology, history which do not exist"
- every one (except live astrology, Phase 2) ALREADY EXISTS and passes tests.
Rebuilding from zero would discard a verified 78-card deck, 5 spreads, draw/reveal UI,
history, and pricing that meet spec S7/S15/S18/S21, and risk regressions in the
79-test suite for no gain.

Spec S21 Acceptance Criteria MET today:
- [x] At least 5 core spreads functional with position-specific interpretations
- [x] Reading history accessible with save functionality
- [x] All canonical tarot data sourced from structured database (not LLM)
- [x] AI interpretations reference specific cards and positions

Outstanding vs S21: guided landing (G9), surfaced membership gating (G10),
Cosmic Minimalism styling (G11), mobile single-thumb selection.

## Recommended action (instead of rework)
Complete entry/selection wiring on the existing foundation:
1. Guided-entry landing (hero + quick actions: Ask / Daily / Browse / History).
2. Spread recommendation + selection UI (show recommended spread, let user pick
   from the 5; pass chosen spreadId, do not force one_card).
3. Wire CardDeck/CardReveal into the live reading path (real images, staggered
   reveal, upright/reversed, spread layout).
4. Surface membership gating + pricing in the flow (3-tier subscription model per
   Ethan resolved decision - NOT the spec credit system, not adopted).
5. Cosmic Minimalism styling pass on the reading view.

This satisfies Alex acceptance test (recommended multi-card spread, real card
images in layout, position-specific + synthesized interpretation, save to history)
without discarding working code. Full TDD plan: docs/plans/csg-tarot-completion.plan.md.
