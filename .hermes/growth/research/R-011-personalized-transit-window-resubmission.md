# R-011 — Exact Personalized Transit Window (Resubmission)

Status: RESEARCH

Opportunity: Add one fact-first named-transit module to the existing transit route for “when is Saturn square my Moon” intent.

Evidence and gap: Existing SERPs such as Transits.io and Ascendant Chart provide generic transit lookup. CSG can show deterministic exact windows, repeated passes, known-time limits, and a primary CTA without mass-generated pages.

Cheapest experiment: 30-day A/B test on one existing route and one named aspect, Saturn square natal Moon. Control is the current route; treatment adds the module. Instrument 7 days before treatment.

Primary metric: completed named-transit result / named-transit starts.
Secondary metrics: CTA clicks, account/save starts, error rate.
Success: treatment improves primary completion by 20% with at least 50 eligible starts and no error-rate regression above 1 percentage point.
Kill: fewer than 50 eligible starts, no primary-metric improvement, or any astronomical fact error.

Conversion: account/save; Yearly Transit Forecast CTA only if production route, checkout, entitlement, and delivery are verified, otherwise free-chart retention.

Scope: one component, deterministic data contract, event schema, CTA, and test flag. No new SEO cluster.
