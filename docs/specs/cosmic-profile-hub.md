# Cosmic Profile Hub — Product Specification (PRO)

**Author:** Alex (Product Director, CSG)
**Date:** 2026-08-12
**Status:** Draft for build — to be delivered to Pike (developer) as Linear Issue PRO-*
**Depends on:** Auth (login/signup/session), Billing/Entitlement (Cosmic Pass), existing `users` / `natal_charts` / `readings` tables.

---

## 0. TL;DR (for Ethan)

We are building a single, persistent **Cosmic Profile Hub** — the logged-in home for every CSG customer. It is the destination that every user-generated artifact should link back to. Today the site generates charts, reports, and tarot readings but most of that data is orphaned: reports vanish after the page reloads, horoscopes are anonymous, and tarot history has no link back to the actual reading. The Profile Hub fixes that and adds the capability you described: a longitudinal journal of readings + an insights layer that surfaces recurring patterns (cards, signs, themes, timing).

This spec defines the product, the data model, the IA, the pattern-analysis approach, and the precise developer tasks with acceptance criteria.

---

## 1. Current State Audit (evidence from codebase)

**What exists:**
- `users` table (id, email, password_hash, first_name, last_name, role, created_at, subscription_tier).
- `natal_charts` table (per-user saved chart; `/api/birth-chart` GET/POST; `/my-chart` page renders it).
- `readings` table — tarot only is persisted today (`src/lib/tarot/store.ts`). Columns: user_id, type, spread_id, reading_type, question, category, result (JSON: positions/cards/interpretation/astrology), meta, reflection, created_at.
- `/api/tarot/history` + `/tarot/history` page (lists tarot readings; entries NOT clickable to detail).
- `/tarot/reading/[id]` + `/tarot/reading/[id]/reflection` (detail + journal — but only reachable if you know the URL; history does not link here = a "dead link" gap).
- Entitlement layer keyed off `users.subscription_tier` (`free`/`premium`/`premium_plus`).
- Auth endpoints `/api/auth/login`, `/api/auth/register`, `/api/auth/user` — but **no `/login` or `/signup` pages exist**, and the header has no account menu.

**What is broken / orphaned (the "dead links to user profiles"):**
1. `/reports` generates Master Reports (transit/synastry/vocation) but **never persists them** — they disappear on reload. No link back to a profile.
2. `/tarot/history` items are not clickable → the reading detail route exists but is unreachable from UI.
3. `/api/horoscope` is fully **anonymous** — no user_id, no persistence. "Common patterns in horoscope" is currently impossible.
4. No `/profile`, `/library`, `/settings`, `/billing`, `/pricing` pages exist at all.
5. Header nav has no account entry point — a signed-in user has no "home."

**Conclusion:** The data foundation exists (users, charts, readings) but there is no hub to own it, and three of the four "ecosystem" data sources are not persisted against the user. The Profile Hub is the missing spine.

---

## 2. Customer Problem & Job To Be Done

**Customer Problem:** "I use CSG for tarot, my chart, and horoscopes, but every session feels like starting over. I can't see what I pulled last month, I can't find an old report, and I have no sense of what themes keep showing up in my life."

**Job To Be Done:** "Give me one private place where everything CSG knows about me lives — my chart(s), my saved reports, my tarot and horoscope history — and show me the patterns across it so I understand myself better over time."

**Transformation:** The customer finishes a session and it's *saved*. Over weeks, the Profile Hub becomes a mirror: "You've pulled The Tower 3 times during Mercury retrogrades; your Leo placements show up whenever you ask about career." That is the CSG moat — persistence + pattern synthesis no single-session tool can offer.

---

## 3. Product Promise (credible)

> "Your cosmic memory. Every chart, reading, and report — kept, connected, and reflected back as the patterns that shape your story."

We promise **storage + retrieval + reflection**, NOT deterministic prediction. Pattern insights are framed as *recurring themes you may notice*, never fate.

---

## 4. Information Architecture

### 4.1 Primary route: `/profile` (the Hub home)
Single authenticated landing. Tabbed or sectioned layout:

- **Overview** — greeting (first name), subscription tier badge, "at a glance" stats (charts saved, readings logged, reports owned, current sun sign transit note), quick-action rail (New Tarot Reading, View Chart, Get a Report, Today's Horoscope).
- **My Charts** — list of `natal_charts` (primary + any others), open/view, set primary. (Future: partner charts for synastry.)
- **Reports Library** — ALL generated Master Reports (transit/synastry/vocation) + purchased Zoom session records. Persisted, re-openable, downloadable (PDF where available).
- **Tarot Journal** — full history of readings, each clickable → `/tarot/reading/[id]`. Filter by spread/category/date.
- **Horoscope Log** — dated daily/weekly horoscope entries the user chose to save (see §6).
- **Patterns** — the insight layer (§7).
- **Settings** — name, email, password, notification prefs, data export/deletion (privacy/compliance).

### 4.2 Secondary routes (all link back to /profile)
- `/login`, `/signup` — auth pages (currently missing; P0).
- `/library` → alias/redirect to `/profile` Reports tab (keeps old mental model; optional).
- Header: signed-in state shows "My Profile" → `/profile` and "Sign out".

### 4.3 Link-repair requirements (closes the dead links)
- `/tarot/history` items → link to `/tarot/reading/[id]`.
- `/reports` "Generate" → after creation, PERSIST and show "View in Library" → `/profile` Reports tab.
- Any "My Chart" CTA → `/profile` Charts tab (or `/my-chart`, which becomes a thin view of the same data).
- Horoscope "Save for later" → writes to `readings` (type='horoscope') → appears in `/profile` Horoscope Log.

---

## 5. Data Model Changes (single source of truth)

Extend, do NOT fork, the existing schema. All user artifacts live in two tables:

### 5.1 `natal_charts` (existing) — no change needed for MVP beyond what exists.

### 5.2 `readings` (extend) — used as the UNIFIED journal
New `type` values beyond `'tarot'`:
- `'horoscope'` — saved horoscope entries. `question` = sign + scope (e.g. "Leo · daily"); `result` JSON = { text, scope, period_start, period_end }.
- `'report'` — Master Reports. `reading_type`/`spread_id` = report id (`transit`/`synastry`/`vocation`); `result` JSON = { title, text, generatedFor (self/partner), pricePaid }.
- `'zoom_session'` — booked live sessions (created on checkout webhook); `result` JSON = { bookedAt, status, meetingLink }.

Add columns (idempotent migration, mirror `src/lib/tarot/migration.sql` style):
```
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS scope character varying,        -- daily/weekly/etc for horoscope
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS price_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS partner_label character varying; -- for synastry
CREATE INDEX IF NOT EXISTS idx_readings_user_type ON readings(user_id, type);
```

### 5.3 New `reading_patterns` (optional cache, not required for MVP)
Precomputed pattern rollups per user, refreshed on write or nightly. See §7.3. For MVP, patterns can be computed on-read (cheap at personal scale).

### 5.4 `users` — add `display_name`, `horoscope_sign` (auto from chart or manual), `patterns_opt_in` boolean default true. Idempotent ALTER.

---

## 6. Horoscope Persistence & Logging

Today `/api/horoscope` is anonymous and stateless. Change:
- Add optional `POST /api/horoscope/save` (auth required) → inserts `readings` row type='horoscope' with sign, scope, text, period dates.
- "Today's Horoscope" widget on Profile Overview and `/horoscope` shows the live blurb AND a "Save to my log" button.
- `/profile` Horoscope Log lists saved entries by date; user can journal a note (reuse `reflection` column) on each.

This converts horoscope from a throwaway gimmick into a longitudinal signal source for Patterns.

---

## 7. Patterns Insight Layer (the differentiator you asked for)

### 7.1 What we surface
From the user's own `readings` + `natal_charts`:
1. **Recurring Tarot Cards** — cards drawn most often, with count + date range + the question themes they appeared under. Flag reversals.
2. **Recurring Themes / Categories** — most common tarot `category` (love, career, clarity…) and report focus areas.
3. **Sign & Element Resonance** — how often their Sun/Moon/Asc sign (or saved `horoscope_sign`) appears in horoscope saves; element balance across pulls.
4. **Timing Correlations** — do certain cards/themes cluster around astrological windows (retrogrades, eclipses, full/new moons)? Compute simple co-occurrence with a calendar of notable transits (we can hardcode a 12-month transit marker set; no live ephemeris required for MVP).
5. **Report Themes** — synthesize the dominant guidance language across their reports (e.g. repeated "boundary" / "visibility" motifs).

### 7.2 Presentation (must avoid generic-AI filler)
- Each pattern shows: **the signal** (e.g. "The Tower — drawn 4 times, always under 'career' questions"), **the window** (dates), and a **reflective prompt** ("When The Tower appears, what in your work life is ending?").
- NO predictions. Use "you may notice," "a theme worth sitting with."
- Sourced strictly from THEIR data — if they have <3 readings, show "Not enough yet — log more to reveal patterns" (honest empty state, not a fake insight).

### 7.3 Computation
- MVP: compute on-read from `readings` for that user (personal-scale, fast).
- V2: cache to `reading_patterns` on each new reading write (trigger or app-level) for snappier loads.

### 7.4 Privacy
- `patterns_opt_in` gate. Off by default? **No — default ON but clearly explained and toggleable in Settings.** Patterns are computed only from the user's own data; never shared.

---

## 8. UX / Visual Direction (Cosmic Minimalism — see csg-report-visual-design)

- Glass-panel cards, gold hairlines, Cinzel/Inter.
- Mobile-first: tabs collapse to a bottom nav or hamburger on the Profile.
- Every artifact row: icon + title + date + one-line context + chevron → detail.
- Empty states are branded and instructive, never dead ends.
- Tier badge uses existing `subscription_tier` so free vs Cosmic Pass sees appropriate CTAs (e.g. Patterns is a Cosmic Pass feature — gate via `buildEntitlement`).

---

## 9. Entitlement / Monetization Tie-In

- **Free:** save charts, tarot journal, horoscope log. Patterns insight = **Cosmic Pass** feature (drives subscription value).
- **Cosmic Pass:** full Patterns layer + unlimited report library + priority.
- Reports still require per-report payment OR Pass entitlement (existing billing).
- Profile is the retention engine: the more a user logs, the stickier CSG becomes → directly supports the $14.99/mo model.

---

## 10. Pricing / Scope Note

No new standalone price — Profile Hub is a platform capability, not a SKU. It increases Cosmic Pass perceived value (already $14.99/mo / $129.99/yr). Confidence: High. No competitive pricing research needed for this build; the differentiator is *persistence + pattern synthesis*, which free single-session apps (many horoscope apps) do not offer cohesively.

---

## 11. Risks & Tradeoffs

- **Privacy/compliance:** storing journals = PII. Must offer export + delete in Settings (GDPR/CCPA hygiene). Mitigation: Settings data controls (§4.1).
- **Scope creep:** Patterns could become a ML project. Mitigation: MVP is on-read aggregation, not modeling.
- **Stale "dead link" perception:** must ship link-repairs (§4.3) in same release or the Hub feels disconnected. Mitigation: bundle as one issue.
- **Auth gap:** Hub is useless without login. Mitigation: auth pages are P0 prerequisite (already a known launch blocker).

---

## 12. Acceptance Criteria (Definition of Done)

- [ ] `/login` and `/signup` pages exist, functional, route to `/profile` on success.
- [ ] Header shows account menu when authenticated → My Profile / Sign out.
- [ ] `/profile` renders Overview, Charts, Reports, Tarot Journal, Horoscope Log, Patterns, Settings tabs for an authenticated user.
- [ ] Generating a Master Report on `/reports` persists a `readings` row (type='report') and offers "View in Library" → `/profile` Reports.
- [ ] `/tarot/history` items link to `/tarot/reading/[id]` (dead link closed).
- [ ] Horoscope "Save" persists type='horoscope' and appears in `/profile` Horoscope Log.
- [ ] Patterns tab shows real aggregations from the user's data; <3 readings shows honest empty state; gated to Cosmic Pass.
- [ ] Settings supports name/email/password update + data export + delete account.
- [ ] All new writes use the canonical `readings`/`natal_charts` tables; no duplicate sources of truth.
- [ ] Mobile layout verified; no broken routes (every nav/CTA target returns 200 or a real destination).
- [ ] No generic-AI filler in any Profile copy; patterns framed as reflection, not prediction.

---

## 13. Open Question for Ethan (judgment call)

Should **Patterns** be:
(a) Cosmic Pass only (recommended — strengthens subscription), or
(b) free for all (maximizes engagement, weaker monetization)?
I recommend (a) but will build the gate so it's a one-line config flip either way.
