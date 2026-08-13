-- Cosmic Profile Hub — idempotent schema extension.
-- Re-runnable on the existing Render Postgres. Extends `readings` (unified journal)
-- and `users` (profile + preferences). No forking of existing tables.

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
