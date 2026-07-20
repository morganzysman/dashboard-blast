-- Migration: add order channel/source to the per-order ledger.
--
-- OlaClick tags every order with a `source` (the sales channel):
--   RAPPI        -> Rappi marketplace
--   RAPPI_TURBO  -> Rappi Turbo
--   WEB          -> own web storefront
--   OUTBOUND     -> order we created ourselves (treated as POS)
-- We store it raw (uppercased) and map to display labels on read. Source comes
-- from the cheap order-list endpoint, so the skeleton upsert backfills it on the
-- next sync for every order — no detail re-fetch needed.
--
-- Enables the "burgers per order per shop per service" double-entry matrix.

ALTER TABLE combo_order_facts ADD COLUMN IF NOT EXISTS source VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_combo_facts_token_source_day
  ON combo_order_facts(company_token, source, day_local);

COMMENT ON COLUMN combo_order_facts.source IS 'Order sales channel (RAPPI, RAPPI_TURBO, WEB, OUTBOUND=POS). Raw uppercased value from OlaClick order.source.';
