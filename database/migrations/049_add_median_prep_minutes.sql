-- Migration: store median prep-time alongside the existing mean.
--
-- Mean prep times are routinely blown up by 80-minute waiter-mark-late
-- outliers; the median is far more representative of the typical kitchen
-- experience. The UI now leads with the median and falls back to the mean
-- as a secondary tooltip value, so we store both columns.
--
-- Cross-day rollups (range queries in /api/employee-sla/account-matrix)
-- use a weighted-median-of-daily-medians approximation, weighted by
-- `orders_count`. This is documented on the column and in the route's
-- JSDoc. It is NOT an exact percentile across the full multi-day sample,
-- but it tracks the true population median closely as long as per-day
-- order counts are roughly stable — which they are for the kitchen SLA
-- workload (one location, one day, ~tens to hundreds of orders).
--
-- The first 14-day startup recompute pass (employeeSlaService.autoBackfill…)
-- re-writes every column on touched rows because it DELETEs and re-INSERTs
-- the (company_token, day_local) slice, so historical NULLs in this window
-- get populated automatically without an explicit backfill command. Rows
-- older than 14 days will keep NULL until they are recomputed manually.

ALTER TABLE account_kitchen_sla_daily
  ADD COLUMN IF NOT EXISTS median_prep_minutes NUMERIC NULL;

COMMENT ON COLUMN account_kitchen_sla_daily.median_prep_minutes IS
  'Median (50th percentile) of prep_minutes across reliable orders for this (account, day, channel). NULL when orders_count=0. Range queries use weighted median-of-daily-medians (approximation; not exact across days).';

ALTER TABLE employee_kitchen_sla_daily
  ADD COLUMN IF NOT EXISTS median_prep_minutes NUMERIC NULL;

COMMENT ON COLUMN employee_kitchen_sla_daily.median_prep_minutes IS
  'Median (50th percentile) of prep_minutes across this user''s reliable orders for the day. NULL when orders_count=0. Mirrors account_kitchen_sla_daily.median_prep_minutes for parity even if only some UIs read it.';
