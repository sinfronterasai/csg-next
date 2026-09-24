-- Minimal base schema for isolated CI integration tests.
-- Production uses an existing application schema; CI creates only the tables
-- required by the idempotent application migrations and database-backed tests.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text
);

CREATE TABLE IF NOT EXISTS natal_charts (
  id serial PRIMARY KEY,
  user_id integer,
  birth_time timestamptz NOT NULL,
  data jsonb
);

CREATE TABLE IF NOT EXISTS readings (
  id serial PRIMARY KEY,
  user_id integer,
  type text,
  reading_type text,
  spread_id text,
  question text,
  category text,
  result jsonb,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reflection text
);
