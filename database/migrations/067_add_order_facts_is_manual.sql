-- Flag ledger rows that were imported by hand instead of fetched from OlaClick.
--
-- Some accounts sell exclusively through a delivery platform whose provider has
-- no webhook/API integration (Rappi-only shops: La Molina, Magdalena, San
-- Borja). Their revenue arrives as a periodic CSV export that we collapse into
-- one synthetic order per (account, local day) — see
-- server/services/rappiSalesImportService.js.
--
-- These rows must be marked because the OlaClick sync reconciliation
-- (syncComboFactsForDay) soft-deletes any ledger row for a synced day that is
-- absent from the freshly-listed set. A synthetic order id never appears in an
-- OlaClick list and its detail fetch would 404, so the reconciler would wipe
-- every imported day the moment such an account is given a public_api_key.
-- Manual rows are therefore excluded from reconciliation entirely: the importer
-- owns them, the sync never touches them.

ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN order_facts.is_manual IS 'TRUE for rows created by a manual sales import (no OlaClick counterpart). The OlaClick sync must never reconcile or soft-delete these.';

-- The importer looks up "which manual day-rows already exist for this account".
CREATE INDEX IF NOT EXISTS idx_order_facts_manual
  ON order_facts(company_token, day_local)
  WHERE is_manual;
