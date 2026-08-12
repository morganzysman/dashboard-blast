-- Migration: training evidence module.
--
-- Purpose: coach staff on station standards across locations, NOT to police
-- them. Before clocking out an employee may be asked (randomly) to photograph
-- one station and self-check a short list of bullet points. A manager reviews
-- it and leaves written feedback the employee can read afterwards.
--
-- Design notes
--   * Templates are the configurable catalogue ("Photo of the fridge"), owned
--     by a company and optionally targeted at a job_type (kitchen | waiter).
--   * Checkpoints are the bullet points for a template ("are all toppers
--     closed?"), carrying an optional `hint` describing HOW to do it right.
--   * Requests record that a prompt was shown. Keeping them (even when skipped)
--     is what makes the random picker fair: it powers the per-user cooldown and
--     lets managers see participation without guessing.
--   * Submissions/photos are separate tables so listing a review queue never
--     drags BYTEA blobs through the query planner.
--   * Photos live in BYTEA, consistent with ID documents and contract
--     signatures — deploys are ephemeral, so there is no local disk to use.

-- ---------------------------------------------------------------------------
-- Per-company knobs for the clock-out prompt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  -- Probability (0..1) that a given clock-out triggers a prompt. 0 disables the
  -- module for the company without deleting its catalogue.
  prompt_probability NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (prompt_probability >= 0 AND prompt_probability <= 1),
  -- Days before the same template can be asked of the same person again.
  cooldown_days SMALLINT NOT NULL DEFAULT 7 CHECK (cooldown_days BETWEEN 0 AND 90),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Evidence catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_evidence_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  -- NULL = applies to any job_type.
  target_job_type TEXT,
  requires_photo BOOLEAN NOT NULL DEFAULT TRUE,
  min_photos SMALLINT NOT NULL DEFAULT 1 CHECK (min_photos BETWEEN 0 AND 3),
  -- Relative weight in the random pick; higher = asked more often.
  weight SMALLINT NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT training_templates_job_type_check
    CHECK (target_job_type IS NULL OR target_job_type IN ('kitchen', 'waiter'))
);

CREATE INDEX IF NOT EXISTS idx_training_templates_company
  ON training_evidence_templates(company_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS training_evidence_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES training_evidence_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  -- How it should be done, shown as coaching text under the bullet.
  hint TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_checkpoints_template
  ON training_evidence_checkpoints(template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Prompts shown at clock-out
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_evidence_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_token TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Template may be deleted later; the title snapshot keeps history readable.
  template_id UUID REFERENCES training_evidence_templates(id) ON DELETE SET NULL,
  template_title TEXT NOT NULL,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'skipped')),
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_training_requests_user_template
  ON training_evidence_requests(user_id, template_id, created_at DESC);

-- Re-tapping "clock out" must reuse the open prompt instead of re-rolling the
-- dice, otherwise anyone could reroll until they get an easy station.
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_requests_one_pending
  ON training_evidence_requests(user_id) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Submissions + review
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_evidence_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL UNIQUE REFERENCES training_evidence_requests(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_token TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES training_evidence_templates(id) ON DELETE SET NULL,
  template_title TEXT NOT NULL,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  note TEXT,
  -- Frozen copy of the checkpoints and how the employee self-assessed:
  -- [{ checkpoint_id, label, hint, checked }]
  checkpoint_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'reviewed')),
  -- Deliberately two-valued: this is coaching, not a score.
  review_rating TEXT CHECK (review_rating IS NULL OR review_rating IN ('good', 'needs_improvement')),
  review_comment TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_submissions_company_status
  ON training_evidence_submissions(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_submissions_user
  ON training_evidence_submissions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_evidence_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES training_evidence_submissions(id) ON DELETE CASCADE,
  image BYTEA NOT NULL,
  mime TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_photos_submission
  ON training_evidence_photos(submission_id, sort_order);

COMMENT ON TABLE training_evidence_templates IS 'Configurable station-evidence catalogue used by the clock-out training prompt.';
COMMENT ON TABLE training_evidence_requests IS 'Log of prompts shown at clock-out; drives the per-user cooldown and participation reporting.';
COMMENT ON TABLE training_evidence_submissions IS 'Employee-submitted evidence plus the manager feedback attached to it.';
