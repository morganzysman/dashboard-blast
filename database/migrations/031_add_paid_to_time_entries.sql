-- Migration: Add paid flag to time_entries and backfill from locked

ALTER TABLE time_entries 
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: consider previously locked entries as paid
UPDATE time_entries SET paid = TRUE WHERE locked = TRUE;

COMMENT ON COLUMN time_entries.paid IS 'Whether this entry has been paid. Paid entries are immutable.';


