-- Track orders deleted in OlaClick.
--
-- Orders can be deleted in OlaClick hours after creation. When that happens the
-- order simply disappears from the day's order list (a CANCELLED order, by
-- contrast, still appears with status=CANCELLED). Previously our ledger row for
-- a deleted order lingered forever and kept inflating revenue/counts.
--
-- The sync now reconciles each day: any order_facts row for the synced day that
-- is NOT in the freshly-listed set is soft-deleted by stamping deleted_at. The
-- flag is cleared automatically if the order reappears (self-heals a transient
-- partial list). All reads exclude deleted_at IS NOT NULL.
--
-- Soft delete (not a hard DELETE) so we keep an audit trail and can tell "this
-- order used to exist and was removed" apart from "never seen".

ALTER TABLE order_facts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN order_facts.deleted_at IS 'Set when a previously-ledgered order no longer appears in the OlaClick day list (deleted in OlaClick). Cleared if it reappears. Reads must filter deleted_at IS NULL.';

-- Reads always scope by (company_token, day_local) and want only live rows.
CREATE INDEX IF NOT EXISTS idx_order_facts_live
  ON order_facts(company_token, day_local)
  WHERE deleted_at IS NULL;
