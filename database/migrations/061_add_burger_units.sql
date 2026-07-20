-- Migration: add "burger" metrics to the per-order ledger.
--
-- A "burger" is the unified sale unit we actually want to measure: any active
-- (non-canceled) order line item whose product name contains "combo", "burger",
-- OR "smash" (case-insensitive). Quantities are summed, so 2 combos = 2 burgers.
-- Combos are a subset of burgers (burger_units >= combo_units always).
--
-- Why on top of the existing combo columns: naming is inconsistent across shops
-- (Barranco uses "...Burger", Miraflores uses "...Smash"), so a single "combo"
-- match undercounts real burgers at some venues. We keep combo_units for the
-- narrow view and add burger_units for the headline "avg burgers per order".
--
-- Note: existing fetched rows have NULL burger_units until re-fetched. The sync
-- treats a row as needing a fetch when burger_units IS NULL, so one pass
-- backfills these from the order detail; terminal orders are then never
-- re-fetched again.

ALTER TABLE combo_order_facts ADD COLUMN IF NOT EXISTS burger_units INTEGER;
ALTER TABLE combo_order_facts ADD COLUMN IF NOT EXISTS burger_lines INTEGER;
ALTER TABLE combo_order_facts ADD COLUMN IF NOT EXISTS has_burger BOOLEAN;

COMMENT ON COLUMN combo_order_facts.burger_units IS 'Sum of quantities across line items whose name contains combo/burger/smash; null until detail fetched. Unified "burgers sold" metric.';
COMMENT ON COLUMN combo_order_facts.burger_lines IS 'Count of distinct burger-named line items in the order.';
COMMENT ON COLUMN combo_order_facts.has_burger IS 'True when burger_units > 0.';
