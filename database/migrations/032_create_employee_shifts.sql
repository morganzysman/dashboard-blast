-- Migration: Create employee_shifts to define default weekly shifts per account

CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token TEXT NOT NULL REFERENCES company_accounts(company_token) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sunday ... 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_token, weekday)
);

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

COMMENT ON TABLE employee_shifts IS 'Default weekly shifts per user per account (company_token)';
COMMENT ON COLUMN employee_shifts.weekday IS '0=Sunday, 1=Monday, ..., 6=Saturday';


