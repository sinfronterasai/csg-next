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
  ADD COLUMN IF NOT EXISTS patterns_opt_in boolean NOT NULL DEFAULT true;

-- Unknown birth time flag, so saved charts survive re-load and later reports
-- use the same whole-sign (timeless) chart instead of fabricating a time.
ALTER TABLE natal_charts
  ADD COLUMN IF NOT EXISTS unknown_time boolean NOT NULL DEFAULT false;

-- birth_time must be nullable: unknown-time charts store NULL and rely on the
-- unknown_time flag instead of a fabricated time. Without this, the unknown-time
-- save path violates the not-null constraint (500 on POST /api/birth-chart).
ALTER TABLE natal_charts
  ALTER COLUMN birth_time DROP NOT NULL;

-- Public report sharing (feature: /reports/shared/[token]).
-- A report is only reachable publicly via this random uuid, never by its
-- sequential integer id. Without this, sharing by id would let anyone
-- enumerate the readings table and read other users' private reports.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE;

-- Index for the public fetch-by-token lookup.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_readings_share_token ON readings(share_token);

-- n8n report pipeline lifecycle. The app is the system of record; n8n only
-- interprets verifiedFacts and calls back. pipeline_status tracks the async
-- journey of a single report from dispatch through editorial sign-off.
--   NULL/queued      -> dispatched to n8n, awaiting callback
--   processing       -> n8n acknowledged, generating
--   approved         -> passed gates (free) or editor-approved (paid); deliverable
--   needs_editor     -> paid report passed automated gates, awaiting human sign-off
--   rejected         -> failed gates or editor rejection; never delivered
-- result.reportId holds the app-generated UUID that correlates the n8n callback.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS pipeline_status text;

-- Idempotent lookup: find the unified reading by its n8n correlation id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_readings_pipeline_report_id
  ON readings ((result ->> 'reportId')) WHERE type = 'report';

-- ============================================================================
-- n8n report pipeline — callback dedup / conflict detection
-- ----------------------------------------------------------------------------
-- pipeline_callback_hash stores the canonical SHA-256 of the last applied
-- callback payload so the callback route can distinguish an identical replay
-- (idempotent 200) from a conflicting duplicate (409) of the same terminal status.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS pipeline_callback_hash text;

-- NOTE ON INDEX CREATION (deployment correctness):
-- `CREATE INDEX CONCURRENTLY` cannot run inside an explicit transaction block
-- (Postgres requires it to be the only statement in its transaction). Apply this
-- migration with autocommit semantics (e.g. `psql -f migration.sql` or Render's
-- per-statement runner). Do NOT wrap the whole file in BEGIN/COMMIT, or the
-- CONCURRENTLY indexes below will fail with "CREATE INDEX CONCURRENTLY cannot
-- run inside a transaction block". The IF NOT EXISTS guards make the file
-- re-runnable; a failed CONCURRENTLY index can be left invalid and should be
-- dropped + recreated (DROP INDEX CONCURRENTLY IF EXISTS ...; CREATE INDEX ...).
