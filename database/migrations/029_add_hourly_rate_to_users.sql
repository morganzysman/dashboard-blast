-- Migration: Add hourly_rate to users

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,4) DEFAULT 0 CHECK (hourly_rate >= 0);

COMMENT ON COLUMN users.hourly_rate IS 'Default hourly rate for employee payroll calculations';


