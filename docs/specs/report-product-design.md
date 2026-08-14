# Cosmic Spirit Guide (csg-next) — Report Catalog & Product Design

Author: John (content-manager)
Date: 2026-08-13
Source: live browse of csg-next.onrender.com (homepage "Professional Wisdom" block, /birth-chart, /tarot)

====================================================================
PART 1 — WHAT THE SITE ACTUALLY LISTS (verified)
====================================================================

The "Reports" footer link is only an anchor to the homepage's
"Personalized Astrological Services" section. There is NO dedicated
/reports route. Paid items are REQUEST / BOOK LIVE lead forms — NOT
instant self-serve generation. This is the central product gap this
design fixes.

A. FREE INTERACTIVE TOOLS (already built)
  1. Birth Chart (Natal) — /birth-chart
     Inputs: first name, DOB, exact birth time, birth place.
     "I don't know my time" checkbox -> Solar Houses fallback.
  2. Tarot — /tarot
     - One Card (FREE)
     - Past · Present · Future (FREE, 3 cards)
     - Celtic Cross (MEMBER, $4.99, 10 cards)
     - Relationship Dynamics (MEMBER, $4.99, 6 cards)
     - Career Crossroads (MEMBER, $4.99, 6 cards)

B. PAID ASTROLOGY REPORTS (currently lead-form only)
  1. Yearly Transit Forecast — $49
     "Map planetary movements relative to your life nodes over the
      next 12 months."
  2. Synastry Love Report — $65
     "Overlay two charts to unlock structural compatibility, friction
      zones, and soul-contract links."
  3. Vocation and Wealth Map — $55
     "Decode Midheaven aspects and 2nd/10th House dynamics for perfect
      professional alignment."

C. LIVE SERVICE (booking, not generated)
  4. Tarot and Astrological Zoom — $120
     60-minute live virtual session with a "certified cosmic
     high-priestess" (career and destiny).

D. FREE EMAIL PRODUCT
  5. Cosmic Daily Alignment Dispatch
     "Direct planet transits, retrograde survival manuals, and
      customized astrology readings matching your exact birth metrics
      straight to your inbox."

====================================================================
PART 2 — PRODUCT DESIGN FOR EACH REPORT
====================================================================
Design principle: turn every lead-form into an INSTANT self-serve
report (compute from the same birth data the Birth Chart tool already
collects), with a paid depth-upgrade layer. This converts website
traffic into revenue without a human in the loop, and feeds the
Dispatch list for retention.

Each report spec below uses:
  GOAL / INPUTS / COMPUTATION / OUTPUT STRUCTURE / UPSELL / KPI

--------------------------------------------------------------------
1. NATAL (BIRTH) CHART REPORT   [FREE, gateway product]
--------------------------------------------------------------------
GOAL: Convert the free chart calculator into a shareable, saveable
      report that anchors the user's identity in our brand and feeds
      the Dispatch capture.

INPUTS: first name, DOB, birth time (or solar-house fallback),
        birth place (-> lat/long).

COMPUTATION:
  - 10 planets -> sign + house + degree (use aistro horoscope script
    or equivalent ephemeris).
  - Ascendant, Midheaven, North/South Node.
  - Retrograde flags per planet.
  - Dominant element / modality.

OUTPUT STRUCTURE (summary-first, expand-on-demand — see aistro skill):
  Layer 1 Overview: one-row-per-planet table
    [Planet emoji] [Sign @ House, deg] [one-sentence essence ≤100w]
  Layer 2 Detail (on request "Sun"/"全部"):
    For each planet: Strengths / Opportunities / Challenges.
  Always includes: downloadable PDF, "Save to My Chart",
  "Email me my cosmic updates" (Dispatch opt-in), share card.

UPSELL: "Unlock your Yearly Transit Forecast ($49)" + "Get the full
        Vocation & Wealth Map ($55)" CTAs at report footer.

KPI: chart completion rate, Dispatch opt-in %, report-share rate.

--------------------------------------------------------------------
2. YEARLY TRANSIT FORECAST   [$49  ->  design as INSTANT + tiers]
--------------------------------------------------------------------
GOAL: Show the user the next 12 months of planetary motion against
      their natal chart, mapped to concrete life periods.

INPUTS: full natal data (reuse from saved chart) + current date.

COMPUTATION:
  - For each of next 12 months: major transits (Sun, Mercury, Venus,
    Mars, Jupiter, Saturn; note retrogrades) to natal planets/houses.
  - Flag "life nodes": Saturn returns/ squares, Jupiter ingress,
    eclipse seasons touching natal angles.
  - Topic scoring per month (career, love, money, health, growth)
    via deterministic seed "<birthDate>:<month>:topic".

OUTPUT STRUCTURE:
  Layer 1 Overview: 12-month timeline table
    [Month] [Headline transit] [Top topic + score 40-100]
  Layer 2 Detail (per month):
    Planetary Influence / Key Dates / Opportunities / Watch-outs.
  Deliverable: PDF + calendar export (.ics) of key transit dates.

UPSELL: "Book a live deep-dive on your toughest month ($120 Zoom)."

KPI: attach-to-natal %, refund rate, repeat-purchase of other reports.

--------------------------------------------------------------------
3. SYNASTRY LOVE REPORT   [$65  ->  INSTANT]
--------------------------------------------------------------------
GOAL: Overlay two charts; output structural compatibility, friction
      zones, and "soul-contract" links — non-judgmental, constructive.

INPUTS: Person A natal + Person B natal (both full or solar fallback).

COMPUTATION:
  - 7 planet-to-planet overlays (Sun, Moon, Mercury, Venus, Mars,
    Asc, Node) -> aspect type + orb + house overlay.
  - Composite themes: emotional wiring, communication, desire,
    long-term structure.
  - Overall compatibility score (deterministic seed
    "<A birthDate>:<B birthDate>:synastry").

OUTPUT STRUCTURE (summary-first):
  Layer 1 Overview: 7-planet table + overall score
    [Planet pair emoji] [Aspect] [one-line dynamic]
  Layer 2 Detail (per planet):
    Strengths / Friction zones / Bridge (how to harmonize).
  Deliverable: shareable link for Partner B to view, joint PDF.

UPSELL: "Relationship Dynamics Tarot ($4.99)" + "Couples Zoom ($120)."

KPI: partner-invite rate, share rate, romantic vs friendship split.

--------------------------------------------------------------------
4. VOCATION & WEALTH MAP   [$55  ->  INSTANT]
--------------------------------------------------------------------
GOAL: Decode career/finance destiny from 2nd, 6th, 10th houses,
      Midheaven, and Saturn/ Jupiter/ Pluto placements.

INPUTS: full natal data.

COMPUTATION:
  - MC sign + ruling planet aspects -> career archetype.
  - 2nd-house planets -> money relationship & income style.
  - 10th-house planets -> public role & legacy.
  - Saturn (structure/discipline) + Jupiter (expansion) synthesis ->
    vocation timing.
  - Wealth-timing: favorable career-transit windows next 24 months.

OUTPUT STRUCTURE:
  Layer 1 Overview: Vocation archetype + Wealth style + top timing.
  Layer 2 Detail:
    Career Path / Money Psychology / Leadership Style /
    Best Launch Windows (tie to Transit Forecast).
  Deliverable: "Career compass" one-pager PDF.

UPSELL: "Yearly Transit Forecast ($49) to time your launch."

KPI: career-question follow-through, Dispatch career-segment opt-in.

--------------------------------------------------------------------
5. TAROT SPREADS   [1 & 3-card FREE; Celtic Cross / Relationship /
   Career Crossroads $4.99 pay-per-spread (no subscription)]
--------------------------------------------------------------------
GOAL: On-demand symbolic guidance; free cards acquire, paid spreads
      monetize depth.

INPUTS: (optional) question, (optional) focus area.

COMPUTATION: card draw + position meaning + archetype synthesis.
  Spreads:
   - One Card: single insight.
   - PPF: narrative arc (past->present->future).
   - Celtic Cross: 10-position situation deep-dive.
   - Relationship Dynamics: 6-position two-party energy map.
   - Career Crossroads: 6-position decision clarity.

OUTPUT STRUCTURE: per spread, card + upright/rev + position meaning
  + integrated reading. Save to "My Readings".

UPSELL: "Get the astrological why behind this card — Natal ($0)
        / Vocation Map ($55)."

KPI: free->paid spread conversion, readings saved, re-draw rate.

--------------------------------------------------------------------
6. TAROT & ASTROLOGICAL ZOOM   [$120 LIVE — book, don't generate]
--------------------------------------------------------------------
GOAL: High-ticket human session; the only non-automated product.

INPUTS: booking form (name, email, preferred slot, focus: career/
        destiny/relationship), optional natal data pre-fill.

PRODUCT DESIGN:
  - Self-serve scheduler (Calendly-style) replacing "BOOK LIVE".
  - Pre-session: auto-generate a mini natal + current-transit brief
    from saved chart so the reader is prepped (adds perceived value,
    shortens session overhead).
  - Post-session: deliver recording + written summary + a 20% off
    code for any instant report.

KPI: booking rate, no-show rate, post-session report attach rate.

--------------------------------------------------------------------
7. COSMIC DAILY ALIGNMENT DISPATCH   [FREE email — retention engine]
--------------------------------------------------------------------
GOAL: Daily touchpoint that drives repeat visits + report upsells.

INPUTS: user email + saved natal metrics (from any report/chart).

COMPUTATION (per send):
  - Current transits of day (Sun/Moon/Mercury/Venus/Mars sign + any
    retrograde) -> from ephemeris.
  - Moon phase of day (moon-phase script).
  - "Retrograde survival manual" when applicable.
  - ONE personalized line using seed "<birthDate>:<date>:daily"
    matched to the user's natal house currently activated.

OUTPUT STRUCTURE:
  - Header: today's sky (2-3 lines, emoji).
  - Moon phase + personal activation.
  - One tailored micro-reading.
  - CTA: "See your full Transit Forecast" / "Pull a card".
  - Frequency control (daily/weekly) + segment prefs.

KPI: open rate, click-to-report rate, Dispatch->paid conversion.

====================================================================
PART 3 — CROSS-CUTTING PRODUCT RULES
====================================================================
1. ONE BIRTH DATA, MANY REPORTS. Every paid report reuses the saved
   natal chart — never re-ask DOB/time/place. "My Chart" = single
   source of truth.
2. SUMMARY-FIRST, EXPAND-ON-DEMAND. Matches aistro skill Model:
   Layer 1 overview table always; Layer 2 detail on user request
   ("Sun" / "全部" / month name). Prevents wall-of-text, lifts
   engagement, and is the exact pattern already specified for our
   reports.
3. INSTANT > LEAD FORM. Every current REQUEST/BOOK button should,
   after payment, trigger immediate computation + PDF. This is the
   biggest revenue unlock on csg-next.
4. PDF + SHARE + SAVE on every report. Shareability = organic growth.
5. DISPATCH CAPTURE AT EVERY STEP. Chart completion, report purchase,
   and tarot pulls all push to the Dispatch list with segment tags
   (natal/transit/synastry/vocation/tarot).
6. DETERMINISTIC SCORING. Use seeded random-score script so the same
   user+date+topic always yields the same score (consistency builds
   trust).
7. COMPUTE ENGINE = EPHEMERIS. Transit/forecast math uses a proper
   ephemeris (forward-dated lookups against the saved natal chart).
   Natal positions reuse the same ephemeris approach as the existing
   birth-chart tool — no separate ad-hoc estimator.
8. PAID REPORTS ROUTE. Each paid report is served from a dedicated
   new /reports route, backed by a DB/CMS record per purchase — NOT a
   modal on the service card. Payment (Stripe) gates generation.

====================================================================
PART 4 — DECISIONS (resolved with John, 2026-08-13)
====================================================================
- Ephemeris/compute engine: USE A PROPER EPHEMERIS for transits
  (forward-date lookups vs the saved natal chart). Reuses the
  birth-chart tool's existing ephemeris approach.
- Payment + location: Stripe on csg-next; paid reports live at a NEW
  /reports route, each a DB/CMS-backed record (not a modal).
- "Member" tarot tier: PAY-PER-SPREAD ($4.99 each) — NOT a
  subscription.
- Dispatch: see PART 5 — context + pending decision.

====================================================================
PART 5 — DISPATCH CONTEXT & OPEN DECISION (need John's call)
====================================================================
CONTEXT (what the Dispatch question was about): the "Cosmic Daily
Alignment Dispatch" is the free daily email. For every subscriber it
must contain (1) the day's actual sky — Sun/Moon/Mercury/Venus/Mars
signs + any retrograde + the moon phase — and (2) ONE personalized
line derived from that subscriber's saved natal chart (which house
the day's activity hits). The open question was HOW to produce (1):

  (A) NIGHTLY BATCH (recommended): compute the day's transits + moon
      phase ONCE per night, store the result, then at send time stamp
      only the per-user personalized line from each subscriber's saved
      natal data. Cheap, fast, scales to many subscribers.
  (B) LIVE PER USER: at send time, compute the sky fresh for the
      current moment for each individual subscriber. More "live" but
      heavier and usually unnecessary — the sky is identical for
      everyone on a given day.

We also still need to pick the EMAIL PROVIDER (e.g. Resend, SendGrid,
Mailchimp) — that's an Alex/dev call.
DECISION (John, default accepted 2026-08-13): OPTION (A) NIGHTLY BATCH.
Compute the day's transits + moon phase once per night, store the
result, then at send time stamp only the per-user personalized line
from each subscriber's saved natal data. Scales cheaply; the sky is
the same for all subscribers on a given day, so live per-user compute
is unnecessary. EMAIL PROVIDER = TBD (Alex/dev).
