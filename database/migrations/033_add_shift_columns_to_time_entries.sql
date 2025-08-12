-- Migration: Add shift_start and shift_end to time_entries

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS shift_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shift_end TIMESTAMPTZ;

COMMENT ON COLUMN time_entries.shift_start IS 'Scheduled shift start time resolved from employee_shifts at clock-in';
COMMENT ON COLUMN time_entries.shift_end IS 'Scheduled shift end time resolved from employee_shifts at clock-in';


