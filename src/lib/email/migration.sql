-- Durable CSG marketing consent, provider sync, and sequence outbox.
CREATE TABLE IF NOT EXISTS csg_email_subscriptions (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  resend_contact_id text,
  status text NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation','active','unsubscribed','suppressed')),
  language text NOT NULL DEFAULT 'en',
  signup_source text NOT NULL,
  consent_copy_version text,
  consent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csg_email_subscriptions_user ON csg_email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_csg_email_subscriptions_status ON csg_email_subscriptions(status);

CREATE TABLE IF NOT EXISTS csg_email_consent_events (
  id bigserial PRIMARY KEY,
  subscription_id bigint REFERENCES csg_email_subscriptions(id) ON DELETE CASCADE,
  email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('opt_in','confirmation','unsubscribe','resubscribe','hard_bounce','complaint','delivery_failure','suppression')),
  source text NOT NULL,
  consent_copy_version text,
  language text,
  source_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_csg_email_consent_email ON csg_email_consent_events(email, occurred_at DESC);

CREATE TABLE IF NOT EXISTS csg_email_outbox (
  id bigserial PRIMARY KEY,
  subscription_id bigint REFERENCES csg_email_subscriptions(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('sync_contact','send_confirmation','send_result','sequence_step')),
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','succeeded','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csg_email_outbox_due ON csg_email_outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS csg_email_sequence_enrollments (
  id bigserial PRIMARY KEY,
  subscription_id bigint NOT NULL REFERENCES csg_email_subscriptions(id) ON DELETE CASCADE,
  sequence_key text NOT NULL CHECK (sequence_key IN ('general_welcome','tarot_welcome')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  source text NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(subscription_id, sequence_key)
);

CREATE TABLE IF NOT EXISTS csg_email_sequence_steps (
  id bigserial PRIMARY KEY,
  enrollment_id bigint NOT NULL REFERENCES csg_email_sequence_enrollments(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  idempotency_key text NOT NULL UNIQUE,
  UNIQUE(enrollment_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_csg_email_sequence_steps_due ON csg_email_sequence_steps(status, scheduled_at);

CREATE TABLE IF NOT EXISTS csg_email_webhook_events (
  id bigserial PRIMARY KEY,
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
