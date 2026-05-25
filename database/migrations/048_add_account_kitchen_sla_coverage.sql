-- Migration: track "SLA coverage" — the share of evaluated orders whose
-- prepared_at stamp is reliable.
--
-- Waiters mark an order prepared when it leaves the kitchen. When they don't,
-- OlaClick auto-stamps prepared_at with the close time and the order looks
-- like it took 0 minutes to cook, poisoning every SLA average. Today we drop
-- those orders from the SLA via `isPrepStampLikelyMissing` — but the daily
-- table never carried a count of how many orders we dropped, so operators
-- couldn't tell whether "SLA = 98%" was healthy or based on a tiny sample.
--
-- This column stores that drop count per (company_token, day_local, channel).
-- The SLA-coverage % shown in the UI is computed as
--   orders_count / (orders_count + unreliable_prep_count)
-- where `orders_count` is already the "survived the filter" numerator.

ALTER TABLE account_kitchen_sla_daily
  ADD COLUMN IF NOT EXISTS unreliable_prep_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN account_kitchen_sla_daily.unreliable_prep_count IS
  'Orders that had both prepared_at and a close stamp but were dropped from SLA because prepared_at is within 60s of close/finished/completed (i.e. waiter likely did not mark prep). Denominator for SLA coverage = orders_count + unreliable_prep_count.';
