-- Cosmic Profile Hub — idempotent schema extension.
-- Re-runnable on the existing Render Postgres. Extends readings (unified journal)
-- and users (profile + preferences). No forking of existing tables.

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

-- n8n report pipeline lifecycle. The app is the system of record. n8n only
-- interprets verifiedFacts and calls back. pipeline_status tracks the async
-- journey of a single report from dispatch through editorial sign-off.
--   NULL/queued      -> dispatched to n8n, awaiting callback
--   processing        -> n8n acknowledged, generating
--   approved          -> passed gates (free) or editor-approved (paid) and is deliverable
--   needs_editor      -> paid report passed automated gates, awaiting human sign-off
--   rejected          -> failed gates or editor rejection and is never delivered
-- result.reportId holds the app-generated UUID that correlates the n8n callback.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS pipeline_status text;

-- Idempotent lookup: find the unified reading by its n8n correlation id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_readings_pipeline_report_id
  ON readings ((result ->> 'reportId')) WHERE type = 'report';

-- n8n report pipeline — callback dedup / conflict detection.
-- pipeline_callback_hash stores the canonical SHA-256 of the last applied
-- callback payload so the callback route can distinguish an identical replay
-- (idempotent 200) from a conflicting duplicate (409) of the same terminal status.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS pipeline_callback_hash text;

-- NOTE ON INDEX CREATION (deployment correctness).
-- CREATE INDEX CONCURRENTLY cannot run inside an explicit transaction block.
-- Postgres requires it to be the only statement in its transaction. Apply this
-- migration with autocommit semantics, e.g. `node scripts/migrate.mjs` (which
-- runs each statement in its own autocommit query) or `psql -f migration.sql`.
-- Do NOT wrap the whole file in BEGIN/COMMIT, or the CONCURRENTLY indexes will
-- fail with "CREATE INDEX CONCURRENTLY cannot run inside a transaction block".
-- The IF NOT EXISTS guards make the file re-runnable. A failed CONCURRENTLY
-- index can be left invalid and should be dropped and recreated.

-- ============================================================================
-- Per-report one-time purchase / entitlement store (pay-per-report model).
-- Paid astrology reports are individual purchases, NOT granted by subscription
-- tier or tarot entitlements. A purchase is the ONLY thing that entitles a user
-- to generate a specific paid report.
--   status lifecycle: pending -> paid -> consumed
--     pending : checkout session created, not yet paid
--     paid    : Stripe webhook confirmed payment (or server-side re-verification)
--     consumed: the matching report was dispatched and correlated to a reading
-- Uniqueness on stripe_session_id / stripe_payment_id guarantees one payment
-- produces exactly one purchase record. Atomic consumption (FOR UPDATE +
-- conditional UPDATE) guarantees one purchase dispatches exactly one report.
CREATE TABLE IF NOT EXISTS report_orders (
  id                bigserial PRIMARY KEY,
  purchase_id       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  user_id           integer,
  report_type       text NOT NULL,
  sku               text NOT NULL,
  amount            integer NOT NULL,            -- amount in minor units (cents)
  currency          text NOT NULL DEFAULT 'usd',
  status            text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  stripe_payment_id text UNIQUE,
  reading_id        integer,
  report_id         uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_orders_user_type
  ON report_orders (user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_orders_reading
  ON report_orders (reading_id) WHERE reading_id IS NOT NULL;

-- Provider-neutral payment provenance. Existing Stripe rows remain intact;
-- Whop rows use these fields instead of pretending Whop IDs are Stripe IDs.
ALTER TABLE report_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE report_orders ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';
ALTER TABLE report_orders ADD COLUMN IF NOT EXISTS provider_payment_id text;
ALTER TABLE report_orders ADD COLUMN IF NOT EXISTS provider_plan_id text;
ALTER TABLE report_orders ADD COLUMN IF NOT EXISTS purchaser_email text;
CREATE UNIQUE INDEX IF NOT EXISTS ux_report_orders_provider_payment
  ON report_orders (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_orders_purchaser_email
  ON report_orders (lower(purchaser_email))
  WHERE purchaser_email IS NOT NULL;

-- ============================================================================
-- report_orders schema integrity (idempotent; legacy report_purchases untouched).
-- Adds foreign keys to users + readings and CHECK constraints. A DO block guards
-- each constraint so re-running the migration is safe (Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS for these shapes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_orders_user') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT fk_report_orders_user FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_orders_reading') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT fk_report_orders_reading FOREIGN KEY (reading_id) REFERENCES readings(id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_status') THEN
    ALTER TABLE report_orders DROP CONSTRAINT ck_report_orders_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_status') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT ck_report_orders_status
      CHECK (status IN ('pending','paid','consumed','failed','refunded'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_currency') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT ck_report_orders_currency CHECK (currency IN ('usd'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_provider') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT ck_report_orders_provider CHECK (provider IN ('stripe','whop'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_amount') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT ck_report_orders_amount CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_report_orders_sku') THEN
    ALTER TABLE report_orders
      ADD CONSTRAINT ck_report_orders_sku CHECK (sku = 'report-' || report_type);
  END IF;
END $$;

-- Whop one-time purchase entitlements. Payment IDs are the idempotency key:
-- a retried payment.succeeded event cannot grant the same offer twice.
CREATE TABLE IF NOT EXISTS whop_entitlements (
  id          bigserial PRIMARY KEY,
  user_id     integer REFERENCES users(id),
  email       text NOT NULL,
  offer       text NOT NULL,
  plan_id     text NOT NULL,
  payment_id  text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_whop_entitlements_status CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_whop_entitlements_user_offer
  ON whop_entitlements (user_id, offer, status);
CREATE INDEX IF NOT EXISTS idx_whop_entitlements_email
  ON whop_entitlements (lower(email));

-- Whop payment lifecycle tombstones. This closes the out-of-order refund race:
-- a refund received before payment.succeeded must prevent a later success event
-- from creating a fresh entitlement or report order for the same payment.
CREATE TABLE IF NOT EXISTS whop_payment_events (
  payment_id  text PRIMARY KEY,
  state       text NOT NULL,
  plan_id     text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_whop_payment_events_state CHECK (state IN ('succeeded', 'refunded'))
);
CREATE INDEX IF NOT EXISTS idx_whop_payment_events_state
  ON whop_payment_events (state);

-- ============================================================================
-- Password reset tokens and bounded forgot-password abuse controls.
--
-- This block intentionally handles both the clean M11A schema and the legacy
-- production table that stored raw tokens in `token` with a `used` flag.
-- Legacy raw token values are hashed inside PostgreSQL and then removed; the
-- resulting rows are explicitly consumed/revoked and can never authenticate.
-- Legacy timestamp-without-time-zone values are interpreted as UTC only when
-- the database session timezone is UTC. The production database was verified
-- with SHOW timezone = UTC before this reconciliation was authored.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  has_token boolean;
  has_used boolean;
  has_token_hash boolean;
  has_user_id boolean;
  has_id boolean;
  has_consumed_at boolean;
  has_revoked_at boolean;
  created_type text;
  expires_type text;
  constraint_exists boolean;
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NULL THEN
    CREATE TABLE password_reset_tokens (
      id          bigserial PRIMARY KEY,
      user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  text NOT NULL UNIQUE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL,
      consumed_at timestamptz,
      revoked_at  timestamptz
    );
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'token'
    ) INTO has_token;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'used'
    ) INTO has_used;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'token_hash'
    ) INTO has_token_hash;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'user_id'
    ) INTO has_user_id;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'id'
    ) INTO has_id;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'consumed_at'
    ) INTO has_consumed_at;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'revoked_at'
    ) INTO has_revoked_at;

    IF has_token AND NOT has_token_hash THEN
      ALTER TABLE password_reset_tokens ADD COLUMN token_hash text;
      IF current_setting('TIMEZONE') <> 'UTC' THEN
        RAISE EXCEPTION 'Legacy password reset timestamp conversion requires UTC database timezone';
      END IF;
      UPDATE password_reset_tokens
         SET token_hash = encode(digest(token, 'sha256'), 'hex')
       WHERE token_hash IS NULL;
      ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_token_key;
      DROP INDEX IF EXISTS idx_password_reset_tokens_token;
      ALTER TABLE password_reset_tokens DROP COLUMN token;
    ELSIF NOT has_token_hash THEN
      ALTER TABLE password_reset_tokens ADD COLUMN token_hash text;
    END IF;

    IF NOT has_consumed_at THEN ALTER TABLE password_reset_tokens ADD COLUMN consumed_at timestamptz; END IF;
    IF NOT has_revoked_at THEN ALTER TABLE password_reset_tokens ADD COLUMN revoked_at timestamptz; END IF;

    IF has_used THEN
      UPDATE password_reset_tokens
         SET consumed_at = COALESCE(created_at, now())
       WHERE used IS TRUE AND consumed_at IS NULL;
      UPDATE password_reset_tokens
         SET revoked_at = COALESCE(created_at, now())
       WHERE used IS NOT TRUE AND revoked_at IS NULL;
      ALTER TABLE password_reset_tokens DROP COLUMN used;
    END IF;

    SELECT data_type INTO created_type
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'created_at';
    IF created_type = 'timestamp without time zone' THEN
      IF current_setting('TIMEZONE') <> 'UTC' THEN
        RAISE EXCEPTION 'Legacy password reset timestamp conversion requires UTC database timezone';
      END IF;
      ALTER TABLE password_reset_tokens
        ALTER COLUMN created_at TYPE timestamptz USING COALESCE(created_at, now()::timestamp) AT TIME ZONE 'UTC';
    END IF;
    ALTER TABLE password_reset_tokens ALTER COLUMN created_at SET DEFAULT now();
    UPDATE password_reset_tokens SET created_at = now() WHERE created_at IS NULL;
    ALTER TABLE password_reset_tokens ALTER COLUMN created_at SET NOT NULL;

    SELECT data_type INTO expires_type
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'password_reset_tokens' AND column_name = 'expires_at';
    IF expires_type = 'timestamp without time zone' THEN
      IF current_setting('TIMEZONE') <> 'UTC' THEN
        RAISE EXCEPTION 'Legacy password reset timestamp conversion requires UTC database timezone';
      END IF;
      ALTER TABLE password_reset_tokens
        ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';
    END IF;

    IF has_id THEN
      ALTER TABLE password_reset_tokens ALTER COLUMN id TYPE bigint;
      IF to_regclass('public.password_reset_tokens_id_seq') IS NOT NULL THEN
        ALTER SEQUENCE password_reset_tokens_id_seq AS bigint;
      END IF;
    END IF;
    IF has_user_id THEN
      IF EXISTS (SELECT 1 FROM password_reset_tokens WHERE user_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot reconcile password reset tokens with NULL user_id values';
      END IF;
      ALTER TABLE password_reset_tokens ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM password_reset_tokens WHERE token_hash IS NULL) THEN
    RAISE EXCEPTION 'Cannot reconcile password reset tokens with NULL token_hash values';
  END IF;
  ALTER TABLE password_reset_tokens ALTER COLUMN token_hash SET NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.password_reset_tokens'::regclass
       AND conname = 'password_reset_tokens_token_hash_key'
  ) INTO constraint_exists;
  IF NOT constraint_exists THEN
    ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.password_reset_tokens'::regclass
       AND contype = 'f'
       AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.password_reset_tokens'::regclass AND attname = 'user_id')::smallint]
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_active
    ON password_reset_tokens (user_id, expires_at)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id             bigserial PRIMARY KEY,
    email_hash     text NOT NULL,
    ip_hash        text,
    requested_at   timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email_window
    ON password_reset_requests (email_hash, requested_at);
  CREATE INDEX IF NOT EXISTS idx_password_reset_requests_ip_window
    ON password_reset_requests (ip_hash, requested_at)
    WHERE ip_hash IS NOT NULL;
END $$;
