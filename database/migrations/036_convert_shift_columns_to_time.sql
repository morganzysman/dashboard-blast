-- Migration: Convert shift_start and shift_end columns from TIMESTAMPTZ to TIME
-- This aligns the database schema with the actual TIME strings we're storing

-- Convert shift_start column from TIMESTAMPTZ to TIME
ALTER TABLE time_entries 
  ALTER COLUMN shift_start TYPE TIME USING 
    CASE 
      WHEN shift_start IS NULL THEN NULL
      WHEN shift_start::TEXT ~ '^\d{2}:\d{2}:\d{2}$' THEN shift_start::TEXT::TIME
      ELSE shift_start::TIME
    END;

-- Convert shift_end column from TIMESTAMPTZ to TIME  
ALTER TABLE time_entries 
  ALTER COLUMN shift_end TYPE TIME USING 
    CASE 
      WHEN shift_end IS NULL THEN NULL
      WHEN shift_end::TEXT ~ '^\d{2}:\d{2}:\d{2}$' THEN shift_end::TEXT::TIME
      ELSE shift_end::TIME
    END;

-- Update column comments to reflect the new TIME type
COMMENT ON COLUMN time_entries.shift_start IS 'Scheduled shift start time (TIME format in company timezone) resolved from employee_shifts at clock-in';
COMMENT ON COLUMN time_entries.shift_end IS 'Scheduled shift end time (TIME format in company timezone) resolved from employee_shifts at clock-in';

-- Add index for better performance on shift time queries
CREATE INDEX IF NOT EXISTS idx_time_entries_shift_times ON time_entries(shift_start, shift_end) WHERE shift_start IS NOT NULL;
