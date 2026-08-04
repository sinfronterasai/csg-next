-- Tarot readings extension for the existing `readings` table.
-- Idempotent: safe to re-run. Only additive, nullable columns + an index.
ALTER TABLE readings
  ADD COLUMN IF NOT EXISTS spread_id character varying,
  ADD COLUMN IF NOT EXISTS category character varying;

CREATE INDEX IF NOT EXISTS idx_readings_user_created
  ON readings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_readings_tarot_spread
  ON readings (type, spread_id) WHERE type = 'tarot';

-- Task 20: reflection journal on readings
ALTER TABLE readings ADD COLUMN IF NOT EXISTS reflection text;
