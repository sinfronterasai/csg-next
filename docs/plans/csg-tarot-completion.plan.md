# CSG Tarot Completion Plan (TDD)

**Goal:** Close the real gaps in the live Tarot experience per spec S6/S18/S21,
building on the EXISTING foundation (deck, 5 spreads, draw/reveal UI, history,
entitlements) - NOT a rebuild.

**Model:** 3-tier subscription (Free / Premium $4.99 / Premium Plus $9.99), per
Ethan resolved decision. The spec S7/S22 "credit system" was NOT adopted.

**TDD rule:** each task = failing test first (RED), then implementation (GREEN),
then a git checkpoint commit. No task is "done" until its test is green and
`next build` passes.

**Verified already present (do not rebuild):**
- `src/lib/tarot/deck.ts` - 78-card canonical deck w/ image URLs
- `src/lib/tarot/spreads.ts` - 5 MVP spreads w/ full position arrays
- `src/components/tarot/CardDeck.tsx` + `CardReveal.tsx` - staggered reveal UI (orphaned)
- `src/lib/tarot/entitlements.ts` + `pricing.ts` + `PricingTable.tsx` - 3-tier gating
- `/api/tarot/history`, `/tarot/history/page.tsx`, reflection journal - history
- `src/lib/tarot/interpret.ts` - position-specific + cross-card synthesis

---

## Task 1 - Guided-entry landing (spec S6, S10.1, G9)
**RED:** `TarotExperience` test: landing renders hero headline + 4 quick-action
buttons (Ask the Cards / Daily / Browse / History); clicking a chip sets active
category state (no longer a no-op).
**GREEN:** Replace the bare landing in `TarotExperience.tsx` with the guided layout:
hero ("What is calling for your attention?"), quick actions, and wire the 4 category
chips (Love/Career/A Decision/General) to set state that drives recommendation.
**Checkpoint:** commit `feat(tarot): guided-entry landing`.

## Task 2 - Spread recommendation + selection UI (spec S6 step 3, G2)
**RED:** test: after question submit, UI shows the recommended spread (name + card
count + tier) with Accept / Choose different; choosing different renders the 5-spread
picker; selected spreadId is passed to generate (not hardcoded one_card).
**GREEN:** extend `QuestionFlow` / `TarotExperience` to call `/api/tarot/recommend`,
display the recommendation + picker (`spreads.ts` data), and forward the chosen
`spreadId` into the generate call (already threaded via Task fix in 6f12db2 for
question). Add `/tarot/spreads` browse page using `getSpread`.
**Checkpoint:** commit `feat(tarot): spread recommendation + selection`.

## Task 3 - Wire CardDeck/CardReveal into live reading (spec S6 step 4, G3)
**RED:** `ReadingView`/integration test: a multi-card reading renders CardDeck with
real `artRef` images, upright/reversed indicator, and staggered reveal - NOT text-only.
**GREEN:** In `TarotExperience`, render `CardDeck` for the drawn cards BEFORE
`ReadingView` (or inside it), passing `reading.cards` (id, reversed). Confirm
`CardReveal` uses `artRef` from `deck.ts`. This is the fix that makes Alex's
acceptance ("real card images in a layout") true.
**Checkpoint:** commit `feat(tarot): wire CardDeck reveal into reading`.

## Task 4 - Surface membership gating in the flow (spec S21 #3, G10)
**RED:** test: a premium spread (e.g. celtic_cross) shown to a free/anon user
displays a tier/price indicator + "Unlock with Cosmic Pass" CTA; generate is blocked
server-side for unauthorized tier (`spreadTierMet` already enforces this in
`generate.ts` - assert the route 403s).
**GREEN:** In the picker + reading view, show tier badge + standalone price (from
`pricing.ts`) and gate via `spreadTierMet`. Link to `/tarot/pricing`. No credit
system - 3-tier subscription only.
**Checkpoint:** commit `feat(tarot): surface tier gating + pricing`.

## Task 5 - Cosmic Minimalism styling pass (spec S11, G11)
**RED:** visual/regression test: reading view uses dark cosmic gradient + gold accent
+ serif reading type tokens; no layout overflow on mobile (single-thumb select).
**GREEN:** Apply Aetheria tokens (already in tailwind config) to `ReadingView`,
`CardDeck`, landing. Verify mobile single-column + tap-to-zoom on card.
**Checkpoint:** commit `style(tarot): cosmic minimalism reading view`.

## Task 6 - Acceptance verification (Alex S5 test)
**RED:** end-to-end browser test: a relationship question -> recommended multi-card
spread (relationship_dynamics, 5 cards) -> real card images in layout ->
position-specific + synthesized interpretation -> save to history succeeds.
**GREEN:** run live on Render; confirm all steps. Update `REVIEW_RESPONSE.md` with
the verified result and close the review.
**Checkpoint:** commit `verify(tarot): acceptance criteria met end-to-end`.

---

## Out of scope (Phase 2 per spec S18/S19, NOT rebuilt now)
- Live astrology overlay computation (data path exists; Phase 2)
- PDF export (exists; Phase 2 polish)
- Follow-up questions, pattern analysis, /daily, /insights, /astrology-blend
- Stripe billing (PRO-12, separate branch)

## Blast radius
Only `TarotExperience.tsx`, `QuestionFlow.tsx`, `ReadingView.tsx`, `CardDeck.tsx`,
landing/page, and a new `/tarot/spreads` page. No changes to deck/spreads/entitlements
cores. 79 existing tests must stay green; new tests added per task.