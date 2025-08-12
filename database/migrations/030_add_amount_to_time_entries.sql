-- Migration: Add amount to time_entries to store money earned for the entry

ALTER TABLE time_entries 
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) DEFAULT 0 CHECK (amount >= 0);

COMMENT ON COLUMN time_entries.amount IS 'Amount paid/earned for this entry, computed at clockout but editable';


