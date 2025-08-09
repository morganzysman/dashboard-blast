-- Migration: Create payroll tables (time tracking, rates, payroll snapshots, account QR)

-- Time entries per user per account
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent multiple open entries per user/account
CREATE UNIQUE INDEX ux_time_entries_open_per_user_account
  ON time_entries(user_id, company_token)
  WHERE clock_out_at IS NULL;

CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_company_user ON time_entries(company_token, user_id);
CREATE INDEX idx_time_entries_period ON time_entries(company_token, clock_in_at, clock_out_at);

-- Employee hourly rate history (applies from effective_from date inclusive)
CREATE TABLE employee_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  hourly_rate NUMERIC(12,4) NOT NULL CHECK (hourly_rate >= 0),
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One rate per user/account/effective_from
CREATE UNIQUE INDEX ux_employee_rates_effective
  ON employee_rates(user_id, company_token, effective_from);
CREATE INDEX idx_employee_rates_lookup
  ON employee_rates(user_id, company_token, effective_from DESC);

-- Payroll snapshots (one per user per period per account)
CREATE TABLE payroll_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_token VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label CHAR(1) NOT NULL CHECK (period_label IN ('A','B')),
  total_seconds BIGINT NOT NULL DEFAULT 0,
  applied_hourly_rate NUMERIC(12,4) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_payroll_snapshots_unique
  ON payroll_snapshots(company_token, user_id, period_start, period_end);
CREATE INDEX idx_payroll_snapshots_company_period
  ON payroll_snapshots(company_token, period_start, period_end);

-- One QR code per account
CREATE TABLE account_qr_codes (
  company_token VARCHAR(255) PRIMARY KEY,
  qr_secret UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_qr_codes_updated_at BEFORE UPDATE ON account_qr_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE time_entries IS 'Employee clock-in/out records stored with second precision (no rounding).';
COMMENT ON TABLE employee_rates IS 'Hourly rate history per employee/account; new records apply next pay period.';
COMMENT ON TABLE payroll_snapshots IS 'Biweekly payroll per user per account with applied rate and totals.';
COMMENT ON TABLE account_qr_codes IS 'One secure QR secret per account for clock-in/out.';
