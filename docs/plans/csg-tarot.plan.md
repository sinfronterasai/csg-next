# CSG Tarot Feature Implementation Plan (re-grounded for csg-next)

> **For Hermes:** Execute task-by-task via `/tdd-workflow` after grounding. Every path below was verified against the real `csg-next` tree on 2026-08-03. The repo has NO test framework yet (no jest/vitest, no config). Task 0 installs one before any TDD cycle can start.

**Goal:** Ship a guided, astrology-blended Tarot experience inside csg-next: user asks a question, gets a recommended spread, draws animated cards, receives a contextual reading blended with their birth chart, and saves it to a personal journal.

**Architecture:** Next.js 15 App Router feature module (`src/app/tarot/*`) backed by new API routes (`src/app/api/tarot/*`). The current `src/app/api/tarot/route.ts` is a STUB (draws cards, never calls Groq, returns a placeholder string) — it will be replaced/extended, not built net-new. Tarot deck and spread definitions are static TypeScript seed data under `src/lib/tarot/`. Readings persist to existing Postgres via `src/lib/db.ts` (pg client) under a new `readings` table — csg-next uses `pg`, NOT Prisma (the plan's Prisma assumption was wrong; corrected below). The LLM interpretation uses the existing real `src/lib/groq.ts` (`generateText(prompt, opts)`). Astrology blend uses the real `src/lib/astrology.ts` (SIGNS/PLANETS/HOUSES + `signFromLongitude`, `dignityFor`, `formatDegree`). Access control reuses `src/lib/auth.ts` (`verifyToken`) with a new entitlement check for free vs paid vs pay-as-you-go.

**Tech Stack (verified present in csg-next):** Next.js 15, React 18, TypeScript, Tailwind CSS (config at `tailwind.config.ts`), `groq-sdk` (interpretation), `pg` (db), `jsonwebtoken`/`bcryptjs` (auth), `@fusionstrings/swiss-eph` + `astronomia` (chart math), `tz-lookup`. Framer Motion is NOT yet a dependency — must be added for card animation (Task 11) or use CSS/Tailwind animation. Test runner to be added in Task 0 (jest + ts-jest recommended to match legacy repo's jest usage).

---

## Verified current state (2026-08-03)

- `src/app/api/tarot/route.ts` — stub: `draw(n)` returns N card NAMES only (no meanings, no orientation, no Groq call). POST requires `auth_token` cookie (real auth). Returns placeholder interpretation. This is the baseline to replace.
- `src/lib/groq.ts` — real Groq client, `generateText(prompt, {systemPrompt, model, temperature, max_tokens})`. `GROQ_API_KEY` required.
- `src/lib/astrology.ts` — full reference data + helpers. Usable for the astrology blend.
- `src/lib/auth.ts` — `verifyToken(token)` (JWT). Real.
- `src/lib/db.ts` — `pg` Pool. Readings persist here (raw SQL or a thin repo), not Prisma.
- `src/lib/chartEngine.ts` — exists; birth-chart computation source if blend needs live calc.
- NO tarot UI, NO spreads, NO deck seed, NO entitlements, NO tests, NO framer-motion.

---

## Files to create/modify (REAL paths)

Create:
- `src/lib/tarot/deck.ts` (78-card seed: id, name, suit, upright, reversed, artRef)
- `src/lib/tarot/spreads.ts` (5 spread defs: id, name, tier, positions[])
- `src/lib/tarot/recommend.ts` (category -> spread, pure fn)
- `src/lib/tarot/interpret.ts` (prompt assembly + Groq call; astrology injection)
- `src/lib/tarot/entitlements.ts` (access gating)
- `src/lib/tarot/store.ts` (readings CRUD via `src/lib/db.ts`)
- `src/app/tarot/page.tsx` (guided entry)
- `src/app/tarot/reading/[id]/page.tsx` (result view)
- `src/app/tarot/history/page.tsx` (journal)
- `src/components/tarot/QuestionFlow.tsx`, `SpreadPicker.tsx`, `CardDeck.tsx`, `CardReveal.tsx`, `AstrologyOverlay.tsx`, `ReadingView.tsx`, `PricingGate.tsx`
- `src/app/api/tarot/spreads/route.ts`, `recommend/route.ts`, `draw/route.ts`, `reading/route.ts`, `readings/route.ts`
- `tests/tarot/deck.test.ts`, `spreads.test.ts`, `recommend.test.ts`, `entitlements.test.ts`, `draw.test.ts`, `interpret.test.ts`, `store.test.ts`

Replace/modify:
- `src/app/api/tarot/route.ts` (replace stub with proper draw/reading or fold into new routes)
- `src/lib/db.ts` or a migration for `readings` table (pg, raw SQL; no Prisma)
- `src/lib/auth.ts` or a new `src/lib/tarot/entitlements.ts` for entitlement wiring
- `package.json` (add jest + ts-jest + @types/jest + framer-motion in Task 0/11)
- `tailwind.config.ts` (Cosmic Minimalism tokens if not present)

---

## Task 0: Test tooling + seed decision (BLOCKER for TDD)

**Objective:** Make `tdd-workflow` runnable. csg-next has no test runner.
**Step 1:** Add `jest`, `ts-jest`, `@types/jest`, `jest-environment-jsdom` (for React component tests) to devDependencies; add `jest.config.ts` with ts-jest preset and `testMatch` for `tests/**/*.test.ts(x)`. Add `"test": "jest"` and `"test:cov": "jest --coverage"` to scripts.
**Step 2:** Dry-run `npx jest --version` to confirm install.
**Step 3:** Add `framer-motion` to dependencies (Task 11 needs it) OR decide CSS animation instead — flag the choice.
**Step 4:** Resolve the free-tier spread contradiction (see Risks #1) in writing before Task 3.
**Step 5:** Commit `chore(tarot): add jest + test config` (no test logic yet).
**Verification:** `npx jest --version` prints a version; `npm test` runs (may report "no tests found" = acceptable at this stage).

---

## Phase 0 (cont.): seed data

### Task 1: Reconcile free-tier spread list
Same as original Task 1. Resolve the Daily Love vs Celtic Cross/Relationship Dynamics contradiction. Post resolved list to Linear; get sign-off. No code.

### Task 2: 78-card deck seed
Create `src/lib/tarot/deck.ts`. Test `tests/tarot/deck.test.ts`: `deck.length === 78`, every card has `id, name, suit, upright, reversed, artRef`. Note: legacy `tarot-data.js` (in old csg repo) already has 78-card data + meanings — reuse as the content source, port to typed `src/lib/tarot/deck.ts`. Run jest -> FAIL -> implement -> PASS. Commit.

### Task 3: Spreads + positions
Create `src/lib/tarot/spreads.ts`. Test asserts 5 spreads with `id, name, tier (free|paid), positions[]` (label + meaning), Celtic Cross has 10 positions. Implement per Task 1. PASS. Commit.

---

## Phase 1: Persistence (pg, not Prisma)

### Task 4: readings table
Modify `src/lib/db.ts` or add migration SQL: `readings (id uuid pk, user_id, spread_id, question, category, positions jsonb, cards jsonb, interpretation jsonb, astrology jsonb, created_at)`. Run against shared dev Postgres (env `DATABASE_URL`). Commit `feat(db): add readings table`.

### Task 5: Reading repository
Create `src/lib/tarot/store.ts` (save/list/get with ownership). Test `tests/tarot/store.test.ts` against a test DB or mocked `pg`. PASS. Commit.

---

## Phase 2: Catalog + access

### Task 6: Entitlement check
Create `src/lib/tarot/entitlements.ts`. Test 3 cases: anonymous -> free only; Cosmic Pass -> all; free requesting paid -> denied + payg price. Implement reading subscription state from `src/lib/auth.ts`. PASS. Commit.

### Task 7: Spreads list API
Create `src/app/api/tarot/spreads/route.ts`. Integration test GET returns 5 spreads with `allowed` + `price`. PASS. Commit.

---

## Phase 3: Guided entry + recommend

### Task 8: Recommendation rules
Create `src/lib/tarot/recommend.ts` (pure). Test: love -> Relationship Dynamics; career -> Career Crossroads; general -> One Card/PPF; unknown -> PPF. PASS. Commit.

### Task 9: Recommend API + QuestionFlow UI
Create `src/app/api/tarot/recommend/route.ts`, `src/components/tarot/QuestionFlow.tsx`, `src/app/tarot/page.tsx`. Test API returns spread id per category. Build UI. Manual: load /tarot, type question, see recommendation. Commit.

---

## Phase 4: Draw + reveal

### Task 10: Draw logic (server)
Create `src/app/api/tarot/draw/route.ts` + test `tests/tarot/draw.test.ts`: One Card -> 1 card; no dupes; reversed boolean. Seeded RNG for testability. PASS. Commit.

### Task 11: CardDeck + CardReveal
Create `src/components/tarot/CardDeck.tsx`, `CardReveal.tsx`. Framer Motion (added Task 0) or CSS. Manual: animation correct. Commit.

---

## Phase 5: Interpretation pipeline

### Task 12: Prompt assembly
Create `src/lib/tarot/interpret.ts` (pure assembly, calls `generateText` from `src/lib/groq.ts`). Test: PPF draw -> prompt has question + each position label/card/orientation + synthesis; NO astrology block when chart absent. PASS. Commit.

### Task 13: Astrology overlay injection
Modify `interpret.ts` + test: with astrology payload -> prompt includes chart + transit summary. Fetch via existing birth-chart source (`src/lib/chartEngine.ts` / `src/lib/astrology.ts`); transit source may be missing — flag. PASS. Commit.

### Task 14: Reading generation API
Create `src/app/api/tarot/reading/route.ts`. Test (mock Groq): POST returns interpretation + Reading id; unauthorized paid spread rejected by entitlement. Implement: assemble -> call LLM -> save via store. PASS. Commit.

### Task 15: ReadingView + result page
Create `src/components/tarot/ReadingView.tsx`, `src/app/tarot/reading/[id]/page.tsx`. Manual browser check. Commit.

---

## Phase 6: Journal + patterns

### Task 16: History page + save flow
Create `src/app/tarot/history/page.tsx`; extend `store.test.ts` for ordering + category grouping. Manual: reading appears in history. Commit.

---

## Phase 7: Gating + pricing

### Task 17: Gate paid spreads
Modify `SpreadPicker.tsx`, draw + reading routes. Test: free POST Celtic Cross -> 402 + price; pass -> 200. PASS. Commit.

### Task 18: Pricing/upgrade UI
Create `src/components/tarot/PricingGate.tsx`. Tier cards per spec; link to existing subscription flow. Manual gating states. Commit. (Stripe payg charge optional — see Risks #3.)

---

## Phase 8: Polish

### Task 19: Cosmic Minimalism styling
Apply dark + gold theme to all tarot surfaces; replace placeholder art with artRef. Manual visual QA. Commit.

### Task 20: PDF export + reflection (Cosmic Pass)
Extend ReadingView; add export. Test export returns PDF for pass users only. Commit.

---

## Tests / validation summary
- Unit: deck, spreads, recommend, entitlements, draw, interpret (pure, fast).
- Integration: spreads API, recommend API, draw API (gated), reading API (mocked Groq), readings list.
- Manual QA: free flow, pass flow, payg lock, animation, history.
- Build gate: `ESLINT=0 npx next build --no-lint` (csg-next memory note). Run `npm test` for unit/integration. `scripts/run_tests.sh` referenced in workspace but absent in csg-next — use `npm test` instead.

## Risks, tradeoffs, open questions (corrected)
1. Free-tier contradiction (Task 1): access table vs MVP list disagree on Daily Love. Resolve before Task 3.
2. LLM provider: Groq is already wired (`src/lib/groq.ts`, `GROQ_API_KEY`). Use it; mock behind `generateText` for tests. No provider decision needed.
3. Pay-as-you-go payments: real Stripe charge may be out of MVP scope. Gate on entitlement + show price; defer actual charge with TODO. Confirm.
4. Transit endpoint: birth chart math exists (`chartEngine.ts`); a current-transits endpoint may not. Task 13 flags; add minimal transit calc or defer transit portion.
5. Card art assets: placeholders for MVP; real art is a content task.
6. Voice input: mic button stub for MVP; Web Speech API later.
7. Reversed cards: included from Task 2/10.
8. Pattern analysis: MVP = category grouping + repeat-card detection; deeper deferred.
9. NEW: no test runner (Task 0). NEW: pg not Prisma (Task 4). NEW: framer-motion absent (Task 0/11). NEW: existing stub route `src/app/api/tarot/route.ts` must be replaced, not duplicated.

## Execution handoff
Paths verified against csg-next (2026-08-03). Run `/tdd-workflow docs/plans/csg-tarot.plan.md`. Task 0 (test tooling) MUST complete before any other TDD cycle.
