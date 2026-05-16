-- Migration: add job_type to users (kitchen | waiter)
-- Used by the per-employee kitchen-SLA pipeline to know which clocked-in users
-- should be attributed to a given order. NULL = unknown / not applicable.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS job_type TEXT;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_job_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_job_type_check
  CHECK (job_type IS NULL OR job_type IN ('kitchen', 'waiter'));

CREATE INDEX IF NOT EXISTS idx_users_job_type ON users(job_type) WHERE job_type IS NOT NULL;

COMMENT ON COLUMN users.job_type IS 'Operational job role used by the per-employee kitchen-SLA pipeline: kitchen (cook) or waiter; NULL when not categorised.';
