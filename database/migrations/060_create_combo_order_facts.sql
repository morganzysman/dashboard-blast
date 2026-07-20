-- Migration: per-order combo ledger.
--
-- Purpose: compute "average combos per order per day" where a "combo" is any
-- active (non-canceled) order line item whose product name contains the
-- substring "combo" (case-insensitive) — NOT OlaClick's native combo concept.
--
-- Why a per-order ledger instead of a daily aggregate table:
--   The combo count is only available on the Public API's single-order detail
--   endpoint (GET /v1/orders/{id} -> combos[]), not on the order list. Syncing
--   therefore means one detail call per order. Storing one row per order keyed
--   by order_id makes the sync idempotent and resumable: a run lists the day
--   (cheap), then fetches detail ONLY for terminal orders not already marked
--   fetched. A 429/crash mid-run just leaves gaps the next run fills; terminal
--   (FINALIZED/CANCELLED) orders are immutable, so once fetched they are never
--   re-fetched. The daily average is derived from this ledger on read.
--
-- Grain: one row per (company_token, order_id). day_local is the order's local
-- calendar day (company timezone) used for the daily rollup query.

CREATE TABLE IF NOT EXISTS combo_order_facts (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,

  day_local DATE NOT NULL,
  status VARCHAR(64),

  -- Combo metrics (null until the order detail has been fetched)
  combo_units INTEGER,          -- sum of quantities of combo-named lines
  combo_lines INTEGER,          -- count of distinct combo-named lines
  has_combo BOOLEAN,            -- true when combo_units > 0
  order_total NUMERIC(12,2),

  -- Sync bookkeeping
  order_updated_at TIMESTAMPTZ, -- order.updated_at from OlaClick (change detection)
  fetched_at TIMESTAMPTZ,       -- when we last fetched this order's detail (null = skeleton only)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (company_token, order_id)
);

CREATE INDEX IF NOT EXISTS idx_combo_facts_token_day
  ON combo_order_facts(company_token, day_local);

CREATE INDEX IF NOT EXISTS idx_combo_facts_company_day
  ON combo_order_facts(company_id, day_local);

-- Partial index to quickly find orders still needing a detail fetch.
CREATE INDEX IF NOT EXISTS idx_combo_facts_unfetched
  ON combo_order_facts(company_token, day_local)
  WHERE fetched_at IS NULL;

COMMENT ON TABLE combo_order_facts IS 'Per-order combo ledger (combo = line item whose product name contains "combo"). Idempotent/resumable source for average-combos-per-order analytics.';
COMMENT ON COLUMN combo_order_facts.day_local IS 'Order local calendar day (company timezone) for daily rollups.';
COMMENT ON COLUMN combo_order_facts.combo_units IS 'Sum of quantities across combo-named line items; null until detail fetched.';
COMMENT ON COLUMN combo_order_facts.fetched_at IS 'Last detail fetch time; null means only the list skeleton is stored.';
