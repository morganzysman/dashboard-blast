-- Audit log for manual sales imports (Rappi CSV uploads).
--
-- One row per committed upload. The ledger rows themselves are idempotent
-- upserts keyed by (company_token, order_id), so re-uploading an overlapping
-- export silently replaces the affected days. That makes it impossible to tell
-- from order_facts alone who uploaded what and when, or why a day's total
-- changed. This table keeps that trail: the file name, the operator, the day
-- range covered, and the per-account/per-day breakdown in `summary`.

CREATE TABLE IF NOT EXISTS manual_sales_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Provider the export came from. Only 'RAPPI' today; kept generic so a second
  -- webhook-less platform doesn't need a schema change.
  provider VARCHAR(32) NOT NULL DEFAULT 'RAPPI',
  file_name VARCHAR(255),

  rows_total INTEGER NOT NULL DEFAULT 0,      -- data rows in the file
  rows_counted INTEGER NOT NULL DEFAULT 0,    -- rows that contributed to a total
  rows_skipped INTEGER NOT NULL DEFAULT 0,    -- cancelled / unmapped / duplicate
  days_created INTEGER NOT NULL DEFAULT 0,
  days_updated INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  first_day DATE,
  last_day DATE,

  -- Full per-account/per-day detail: previous vs new amount for every day the
  -- upload wrote, plus the warnings shown at preview time.
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The history panel lists a company's most recent uploads first.
CREATE INDEX IF NOT EXISTS idx_manual_sales_imports_company_created
  ON manual_sales_imports(company_id, created_at DESC);
