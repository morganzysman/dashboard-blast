-- Remove the kitchen / employee SLA feature entirely.
--
-- The SLA process (kitchen prep-time targets, per-employee and per-account
-- SLA rollups, breach drill-downs) has been retired to make the app lighter.
-- All related services, routes, cron jobs and UI were removed; these tables
-- are now dead storage. Dropping them is safe — no remaining code reads them.
--
-- NOTE: users.job_type (kitchen | waiter | null) is intentionally kept — it is
-- a general employee attribute used for staff categorization, not SLA-only.

DROP TABLE IF EXISTS employee_kitchen_sla_orders CASCADE;
DROP TABLE IF EXISTS employee_kitchen_sla_daily CASCADE;
DROP TABLE IF EXISTS account_kitchen_sla_daily CASCADE;
DROP TABLE IF EXISTS kitchen_sla_targets CASCADE;
