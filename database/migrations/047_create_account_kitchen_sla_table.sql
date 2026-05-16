-- Migration: per-account kitchen SLA storage (matrix view).
--
-- Why a separate table from employee_kitchen_sla_*:
--   * employee_kitchen_sla_* only carries rows for orders where at least one
--     job_type='kitchen' user was clocked-in at prepared_at. Account-level
--     reporting must include every prepped order — even when the cook tagging
--     is incomplete or no kitchen user was on shift — otherwise the matrix
--     under-reports total volume and skews on-time %.
--   * Both rollups are built in the same cron pass over the same orders, so
--     they always stay in sync (employee rows are a subset of account rows).
--
-- Grain: one row per (company_token, day_local, channel_key). channel_key is
-- the same `getKitchenChannelKey()` value used everywhere else
-- (DELIVERY:RAPPI_TURBO, DELIVERY:RAPPI, ONSITE:*, etc.). target_minutes is
-- snapshotted on insert from the company's resolved kitchen_sla_targets at the
-- time of compute, so historical rows survive future target changes.

CREATE TABLE IF NOT EXISTS account_kitchen_sla_daily (
  company_token VARCHAR(255) NOT NULL,
  day_local DATE NOT NULL,
  channel_key TEXT NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  total_prep_minutes NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_prep_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  target_minutes INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_token, day_local, channel_key)
);

CREATE INDEX IF NOT EXISTS idx_account_sla_daily_day
  ON account_kitchen_sla_daily(day_local);

CREATE INDEX IF NOT EXISTS idx_account_sla_daily_token_day
  ON account_kitchen_sla_daily(company_token, day_local);

COMMENT ON TABLE account_kitchen_sla_daily IS 'Daily per-account per-channel kitchen SLA rollup. Source-of-truth for the account x service performance matrix; rebuilt idempotently by the same cron that builds employee_kitchen_sla_*.';
COMMENT ON COLUMN account_kitchen_sla_daily.channel_key IS 'getKitchenChannelKey() value, e.g. DELIVERY:RAPPI_TURBO';
COMMENT ON COLUMN account_kitchen_sla_daily.target_minutes IS 'Resolved SLA target at compute time. Snapshotted so historical rows do not drift when targets change.';
