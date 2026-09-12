# Cosmic Profile Hub — Developer Implementation Tasks (for Pike)

Please implement the Cosmic Profile Hub per the attached product spec
(`docs/specs/cosmic-profile-hub.md`). Below are the implementation tasks, each with
objective, current state, required behavior, data requirements, edge cases, and
acceptance criteria. Do NOT write generic UI; follow Cosmic Minimalism (glass-panel,
gold hairlines, Cinzel/Inter) already used across the app.

General constraints (SOUL.md boundary is mine — you are the builder):
- All user artifacts persist to the EXISTING `readings` / `natal_charts` tables. No new
  bespoke stores. Add columns via idempotent ALTER (see Task 0).
- Every route a user can reach must return 200 or a real destination. No 404 CTAs.
- Patterns insights must be computed from the user's OWN data only. Never fabricate.
- Use `buildEntitlement` from `@/lib/tarot/entitlements` for tier gating.

---

## TASK 0 — Schema migration (foundation)
**Objective:** Extend `readings` and `users` to support unified journal + patterns.
**Why:** Without columns, reports/horoscopes can't be persisted coherently.
**Current state:** `readings` has tarot-shaped columns only; `users` lacks display/pref fields.
**Required behavior:** Create `src/lib/profile/migration.sql` (idempotent, re-runnable):
```
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS scope character varying,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS price_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS partner_label character varying;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_readings_user_type ON readings(user_id, type);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name character varying,
  ADD COLUMN IF NOT EXISTS horoscope_sign character varying,
  ADD COLUMN IF NOT EXISTS patterns_opt_in boolean NOT NULL DEFAULT true;
```
**Acceptance:** Migration runs clean on existing Render DB; `npm run build` unaffected.

---

## TASK 1 — Auth pages + header account menu (P0 prerequisite)
**Objective:** Let users sign in/out and reach the Hub.
**Current state:** `/api/auth/login|register|user` exist; NO `/login`, `/signup` pages; header has no account entry.
**Required behavior:**
- New `src/app/login/page.tsx` and `src/app/signup/page.tsx` (client components) posting to existing auth APIs, on success `router.push('/profile')`.
- `SiteHeader.tsx`: when `GET /api/auth/user` returns a user, show "My Profile" (→/profile) + "Sign out" (clear cookie, →/). When anonymous, show "Sign In" (→/login).
**Edge cases:** expired token → treat as anonymous; API error → show inline message, don't crash header.
**Acceptance:** Can register, login, land on /profile, sign out. Header reflects state without reload glitches.

---

## TASK 2 — `/profile` Hub shell + Overview
**Objective:** The authenticated home.
**Current state:** No /profile route.
**Required behavior:**
- `src/app/profile/page.tsx` (client) fetches `/api/auth/user` → if 401, redirect /login.
- Tabbed sections: Overview, Charts, Reports, Tarot Journal, Horoscope Log, Patterns, Settings.
- Overview: greeting (display_name||first_name), tier badge from entitlement, stats (charts count via /api/birth-chart, readings counts by type), quick-action rail.
**Data:** reuse `/api/birth-chart` (GET) and a new `/api/profile/stats` (Task 5).
**Edge cases:** user with zero data → branded empty states per tab, not blank.
**Acceptance:** All 7 tabs render; overview shows correct counts; mobile collapses tabs.

---

## TASK 3 — Reports persistence + Library tab (closes dead link)
**Objective:** Master Reports survive and live in the Hub.
**Current state:** `/api/reports/generate` returns text but never inserts `readings`.
**Required behavior:**
- Extend `POST /api/reports/generate`: after generating `text`, INSERT `readings` (type='report', reading_type=reportId, title, result JSON {title,text,generatedFor,pricePaid}, price_paid from product map). Return `{ id, ... }`.
- `/reports` page: on success, show "View in Library" linking to `/profile` Reports tab (or /profile?tab=reports).
- Profile "Reports" tab lists `readings` WHERE type='report', clickable → a report view (reuse a reader or inline modal showing title + text + download if PDF exists).
**Data:** product prices already in `src/app/reports/page.tsx` PRODUCTS array; replicate server-side in a constant.
**Edge cases:** synastry with partner → store partner_label; generation failure → still no row, show error.
**Acceptance:** Generate → row exists → appears in Library → re-openable after reload.

---

## TASK 4 — Tarot history → detail link repair (closes dead link)
**Objective:** Make saved readings reachable.
**Current state:** `/tarot/history` lists items but they don't link anywhere.
**Required behavior:** Each history item becomes a link to `/tarot/reading/[id]` (route + detail already exist).
**Acceptance:** Clicking a history entry opens the full reading + reflection editor.

---

## TASK 5 — Horoscope persistence + Log tab (closes dead link)
**Objective:** Turn horoscope from throwaway into a logged signal.
**Current state:** `/api/horoscope` GET is anonymous/stateless; no save.
**Required behavior:**
- New `POST /api/horoscope/save` (auth): body { sign, scope, text, periodStart, periodEnd } → INSERT `readings` type='horoscope', scope, period_start/end, title=`${sign} ${scope}`, result JSON {text}.
- Add "Save to my log" button on the horoscope widget (Overview + `/horoscope` if exists; else Overview only).
- Profile "Horoscope Log" tab lists type='horoscope' entries with date + journal note (reuse `reflection`).
**Edge cases:** anonymous user clicking save → prompt login.
**Acceptance:** Save → row persists → appears in Horoscope Log → note can be added.

---

## TASK 6 — Patterns insight layer (Cosmic Pass gated)
**Objective:** The longitudinal "common patterns" feature.
**Current state:** Nothing aggregates user history.
**Required behavior:**
- New `src/lib/profile/patterns.ts`: compute from user's `readings`:
  1. Recurring tarot cards (count, date range, categories they appeared under).
  2. Recurring categories/themes.
  3. Sign/element resonance (from horoscope_sign or chart).
  4. Timing clusters vs a hardcoded 12-month transit-marker set (retrogrades/eclipses/moons).
  5. Report theme motifs (lightweight keyword tally across report texts).
- New `GET /api/profile/patterns` → returns computed object. Gate via `buildEntitlement`: free tier gets 403 with upgrade message.
- Profile "Patterns" tab renders: each pattern = signal + window + reflective prompt. If <3 readings → honest "log more" state.
**Edge cases:** <3 readings; all-one-category; no horoscope data; user opted out (patterns_opt_in=false → 403).
**Acceptance:** Patterns reflect REAL data; framed as reflection not prediction; gated correctly; empty state honest.

---

## TASK 7 — Settings (privacy/compliance)
**Objective:** User control + data hygiene.
**Current state:** No settings surface.
**Required behavior:** Profile "Settings" tab:
- Edit display_name, email (read-only or verified), password (via auth).
- Toggle patterns_opt_in.
- "Export my data" → JSON download of their charts + readings.
- "Delete account" → confirm → DELETE cascade readings/natal_charts/user (or anonymize). Implement server endpoint `POST /api/profile/delete`.
**Acceptance:** Each control works; delete removes user data; export contains all artifacts.

---

## TASK 8 — Link-repair sweep + route hygiene
**Objective:** No dead links remain.
**Required behavior:** Verify every nav/CTA target in SiteHeader, /reports, /tarot/history, Overview rail resolves to a 200 or real page. Relabel or build any gap. Specifically: "My Chart" CTAs → /profile Charts (or keep /my-chart as a thin view). Remove any `href="#"` placeholders in account surfaces.
**Acceptance:** `curl -o /dev/null -w "%{http_code}"` on every CTA target returns 200.

---

## Verification (run before marking done)
1. `npm test && npm run build` GREEN.
2. Manual: register → /profile → generate a report (persists + Library) → do a tarot reading (history links to detail) → save a horoscope (Log) → (with test Pass tier) view Patterns → edit Settings → export → delete (test account).
3. Confirm no new 404s via route sweep.
4. Report what changed, what was tested, what's unresolved.

## Notes for Pike
- This is one cohesive release; ship link-repairs (T4/T5) with the Hub or it feels disconnected.
- Patterns is the differentiator — make it real, not a placeholder.
- Keep the canonical `readings` table as the single source of truth for all journals.
