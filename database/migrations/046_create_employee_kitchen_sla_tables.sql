-- Migration: per-employee kitchen SLA storage.
--
-- Design notes
--   * One order can be handled by a team of cooks. We attribute each order to
--     every kitchen-job_type user who was clocked-in at the moment the order
--     reached the `prepared_at` stamp (per-cook attribution). cook_count is
--     stored on every row so dashboards can normalise by team size if desired.
--   * `employee_kitchen_sla_orders` is the source-of-truth event log; one row
--     per (user, order). The cron rebuilds the day's slice idempotently, so we
--     wipe + insert per (user, account, day) on each run.
--   * `employee_kitchen_sla_daily` is the rolled-up scoreboard used by the UI.
--   * We store `day_local` as a DATE in the account's timezone (resolved by the
--     service layer) so range queries don't have to recompute timezone math.

CREATE TABLE IF NOT EXISTS employee_kitchen_sla_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  order_id TEXT NOT NULL,
  prepared_at TIMESTAMPTZ NOT NULL,
  prep_minutes NUMERIC(10,2) NOT NULL,
  target_minutes INTEGER NOT NULL,
  on_time BOOLEAN NOT NULL,
  channel_key TEXT NOT NULL,
  service_type TEXT NOT NULL,
  day_local DATE NOT NULL,
  cook_count INTEGER NOT NULL DEFAULT 1 CHECK (cook_count >= 1),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_emp_sla_orders_unique
  ON employee_kitchen_sla_orders(user_id, company_token, order_id);

CREATE INDEX IF NOT EXISTS idx_emp_sla_orders_user_day
  ON employee_kitchen_sla_orders(user_id, day_local);

CREATE INDEX IF NOT EXISTS idx_emp_sla_orders_account_day
  ON employee_kitchen_sla_orders(company_token, day_local);

CREATE INDEX IF NOT EXISTS idx_emp_sla_orders_day_local
  ON employee_kitchen_sla_orders(day_local);


CREATE TABLE IF NOT EXISTS employee_kitchen_sla_daily (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  day_local DATE NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  avg_prep_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_prep_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, company_token, day_local)
);

CREATE INDEX IF NOT EXISTS idx_emp_sla_daily_account_day
  ON employee_kitchen_sla_daily(company_token, day_local);

CREATE INDEX IF NOT EXISTS idx_emp_sla_daily_day
  ON employee_kitchen_sla_daily(day_local);

COMMENT ON TABLE employee_kitchen_sla_orders IS 'Per-cook attribution of kitchen orders (one row per attended order per cook). cook_count = team size at prepared_at moment.';
COMMENT ON TABLE employee_kitchen_sla_daily IS 'Daily kitchen SLA roll-up per cook per account. Source-of-truth for leaderboards; rebuilt idempotently by the daily cron.';
