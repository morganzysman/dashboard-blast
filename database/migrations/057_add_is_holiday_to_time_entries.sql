-- Migration: Flag a time entry as a worked public holiday (feriado).
-- In Peru a worked national holiday is paid double (base + 100%). Admins set
-- this flag manually per entry; the per-entry `amount` is stored already
-- reflecting the ×2 premium so downstream payout logic stays a simple sum.
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN time_entries.is_holiday IS 'Worked public holiday (feriado). When true the entry amount already includes the ×2 holiday premium.';
