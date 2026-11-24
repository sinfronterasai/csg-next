-- Additive audit and coordination tables for the editorial submission API.
-- Existing content is not modified. Never drop these after submissions exist
-- without a verified backup and an explicit retention decision.
CREATE TABLE IF NOT EXISTS content_submissions (
  submission_id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  revision integer NOT NULL CHECK (revision > 0),
  body_sha256 text NOT NULL,
  package jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'complete')),
  post_id integer REFERENCES blog_posts(id),
  calendar_id integer REFERENCES content_calendar(id),
  sanity_id text NOT NULL UNIQUE,
  sanity_revision text,
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_submission_revisions (
  submission_id text NOT NULL REFERENCES content_submissions(submission_id),
  revision integer NOT NULL,
  body_sha256 text NOT NULL,
  package jsonb NOT NULL,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, revision)
);
CREATE INDEX IF NOT EXISTS content_submissions_calendar_idx ON content_submissions(calendar_id);
