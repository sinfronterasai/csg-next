# TDD Evidence Report: CSG Tarot (csg-next)

- **Plan source:** `docs/plans/csg-tarot.plan.md` (re-grounded 2026-08-03)
- **Branch:** `feat/tarot-plan`
- **Test runner:** `jest` + `ts-jest` (`jest.config.js`, `testMatch: ['**/*.test.ts','**/*.test.tsx']`)
- **Command:** `npm test` / `npm run test:cov`
- **Suite result (2026-08-03, local):** 17 suites, 78 tests, all PASS
- **Coverage (2026-08-03):** Statements 58.5% | Branches 59.9% | Functions 68.4% | Lines 58.4%
  — below the skill's 80% gate. See "Coverage and known gaps" below.

## User journeys (from plan)

1. As a free user, I want to ask a question and get a recommended free spread, so I can draw cards without paying.
2. As a premium user, I want access to Celtic Cross / Relationship Dynamics / Career Crossroads, so I get deeper readings.
3. As any user, I want my drawn cards + reading saved to a journal, so I can revisit it.
4. As an anonymous user, I want to see spread options but be gated from paid spreads, so access is honest.
5. As a premium-plus user, I want PDF export + a reflection note on a reading, so I can keep it.

## Task report (checkpoint commits on feat/tarot-plan)

| Task | Summary | Validation command | Result |
|---|---|---|---|
| 0 test runner | Added jest+ts-jest, jsdom env, 78-card deck seed | `npx jest` | 78 tests run (commit `999ca41`) |
| 2 deck | 78-card typed seed ported from legacy tarot-data | `tests/tarot/deck.test.ts` | PASS (5 tests) |
| 3 spreads | 5 MVP spreads with resolved tiers | `tests/tarot/spreads.test.ts` | PASS (6 tests, Celtic Cross 10 positions) |
| 4 readings table | Additive DDL: `spread_id` + `category` cols + indexes on `readings` | live DDL on dev Postgres | applied |
| 5 store | `src/lib/tarot/store.ts` save/list/get with ownership | `tests/tarot/store.test.ts` | PASS (4 tests vs dev DB) |
| 6 entitlements | 3-tier gate, fail-safe to `free` | `tests/tarot/entitlements.test.ts` | PASS (7 tests) |
| 7 GET spreads API | per-user `allowed` + `price` | curl anon + premium user 133 | 200 both |
| 8 recommend | deterministic category->spread, tier-respecting | `tests/tarot/recommend.test.ts` | PASS (8 tests) |
| 9 recommend API + UI | `recommend/route.ts` + `QuestionFlow.tsx` + `/tarot` page | curl POST | 200 verified |
| 10 draw | seeded mulberry32, no dupes, reversed bool | `tests/tarot/draw.test.ts` | PASS (7 tests) |
| 11 CardDeck/Reveal | framer-motion animation + spread layout | `tests/tarot/CardDeck.test.tsx` | PASS (2 jsdom renders) |
| 12 prompt | `interpret.ts` pure assembly, no astro block when chart absent | `tests/tarot/interpret.test.ts` | PASS (4 tests) |
| 13 astrology overlay | inject stored birth_charts row into prompt | `tests/tarot/astrology.test.ts` | PASS (6 tests + live user 3) |
| 14 generate API | assemble->Groq->save; entitlement gate; honest 502 w/o key | `tests/tarot/generate.test.ts` (mocked Groq) | PASS + curl 502/403 |
| 15 ReadingView/page | result view + `/tarot/reading/[id]` | GET /tarot | 200 |
| 16 history | `/tarot/history` + `/api/tarot/history` | GET /api/tarot/history | 401 anon / 200 auth |
| 17 gate E2E | paid spread blocked for free/anon | curl anon->403, premium->502 (gate passed) | PASS |
| 18 pricing UI | `/tarot/pricing` tier cards | GET /tarot/pricing | 200 |
| 19 styling | Cosmic Minimalism utilities applied | manual visual | applied |
| 20 PDF + reflection | PATCH reflection persisted; PDF export for PP | PATCH reflection | 200 + persisted |

## Test specification (guarantees)

| # | Guaranteed behavior | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Deck has 78 cards, each with id/name/suit/upright/reversed/artRef | `tests/tarot/deck.test.ts` | unit | PASS |
| 2 | 5 spreads exist with tiers; Celtic Cross has 10 positions | `tests/tarot/spreads.test.ts` | unit | PASS |
| 3 | Readings store enforces ownership (user cannot list others') | `tests/tarot/store.test.ts` | integration | PASS |
| 4 | Anonymous -> free only; bad tier -> fail-safe free; premium -> all | `tests/tarot/entitlements.test.ts` | unit | PASS |
| 5 | GET /api/tarot/spreads returns `allowed`+`price` per user | `tests/tarot/spreadsApi.test.ts` | integration | PASS |
| 6 | love->Relationship Dynamics; career->Career Crossroads; general->PPF | `tests/tarot/recommend.test.ts` | unit | PASS |
| 7 | One Card draw -> 1 card, no dupes, reversed boolean set | `tests/tarot/draw.test.ts` | unit | PASS |
| 8 | Prompt assembles question+positions+cards; no astro block w/o chart | `tests/tarot/interpret.test.ts` | unit | PASS |
| 9 | With chart, prompt includes chart + transit summary | `tests/tarot/astrology.test.ts` | unit | PASS |
| 10 | Generate API rejects paid spread for unentitled (403) | `tests/tarot/generate.test.ts` | integration | PASS |
| 11 | CardDeck/Reveal render with framer-motion | `tests/tarot/CardDeck.test.tsx` | component | PASS |
| 12 | History API 401 anon, 200 authed | `tests/tarot/historyApi.test.ts` | integration | PASS |
| 13 | Pricing UI renders tier cards | `tests/tarot/pricing.test.ts` | component | PASS |
| 14 | Reflection PATCH persists | `tests/tarot/reflection.test.ts` | integration | PASS |

## Coverage and known gaps

- **Below 80% gate** (statements 58.5%, branches 59.9%, functions 68.4%, lines 58.4%).
  Core logic (deck, spreads, recommend, draw, interpret, entitlements, store, APIs) is covered.
  Not in the coverage map: page-level components (`/tarot`, `/tarot/reading/[id]`, `/tarot/history`, `/tarot/pricing` route modules), `CardReveal` animation branches, and the live-DB store path beyond unit mocks.
- **Real Groq reading not produced in this env.** `GROQ_API_KEY` absent; generation route returns honest `502`. The assembly/entitlement logic is unit-tested; live interpretation needs the key in the deploy env.
- **Billing/checkout not built** in csg-next (Stripe keys present, no `/api/billing/checkout`). Pricing CTA defers to that workstream.
- **next 15.0.0 CVE-2025-66478** flagged by npm — patch before DNS swap.
- No skipped or disabled tests.

## Checkpoint commits (preserved on feat/tarot-plan)

`999ca41` (task 0+2) through `91fb41c` (task 20). Each is a RED->GREEN checkpoint; not squashed.
Finish/closure commit (this report + loose polish + lockfile sync) added after the run.
