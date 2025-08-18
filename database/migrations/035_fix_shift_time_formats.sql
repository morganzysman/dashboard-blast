-- Migration: Fix shift time formats to use TIMESTAMPTZ consistently

-- First, create a temporary table to store the old data
CREATE TEMP TABLE temp_employee_shifts AS
SELECT * FROM employee_shifts;

-- Drop the old table
DROP TABLE employee_shifts;

-- Recreate with TIMESTAMPTZ columns
CREATE TABLE employee_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token TEXT NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sunday ... 6=Saturday
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_token, weekday)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_employee_shifts_user_weekday ON employee_shifts(user_id, weekday);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_company_token ON employee_shifts(company_token);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_employee_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_shifts_updated_at ON employee_shifts;
CREATE TRIGGER trg_employee_shifts_updated_at
BEFORE UPDATE ON employee_shifts
FOR EACH ROW EXECUTE FUNCTION update_employee_shifts_updated_at();

-- Function to convert TIME to TIMESTAMPTZ at a specific date
CREATE OR REPLACE FUNCTION convert_time_to_timestamptz(
  time_value TIME,
  weekday INTEGER,
  company_timezone TEXT DEFAULT 'America/Lima'
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  base_date DATE;
  datetime_str TEXT;
BEGIN
  -- Get next occurrence of this weekday
  base_date := CURRENT_DATE + ((weekday - EXTRACT(DOW FROM CURRENT_DATE) + 7) % 7) * INTERVAL '1 day';
  datetime_str := base_date::TEXT || ' ' || time_value::TEXT;
  RETURN datetime_str::TIMESTAMP AT TIME ZONE company_timezone;
END;
$$ LANGUAGE plpgsql;

-- Migrate data from temp table
INSERT INTO employee_shifts (
  id, user_id, company_token, weekday,
  start_time, end_time,
  created_at, updated_at
)
SELECT 
  t.id, t.user_id, t.company_token, t.weekday,
  convert_time_to_timestamptz(t.start_time::TIME, t.weekday, c.timezone),
  convert_time_to_timestamptz(t.end_time::TIME, t.weekday, c.timezone),
  t.created_at, t.updated_at
FROM temp_employee_shifts t
JOIN company_accounts ca ON ca.company_token = t.company_token
JOIN companies c ON c.id = ca.company_id;

-- Drop temporary table
DROP TABLE temp_employee_shifts;

-- Drop the conversion function as it's no longer needed
DROP FUNCTION convert_time_to_timestamptz;

COMMENT ON TABLE employee_shifts IS 'Default weekly shifts per user per account (company_token)';
COMMENT ON COLUMN employee_shifts.weekday IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN employee_shifts.start_time IS 'Shift start time in company timezone';
COMMENT ON COLUMN employee_shifts.end_time IS 'Shift end time in company timezone';
