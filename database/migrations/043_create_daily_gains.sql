-- Create daily_gains table for storing precomputed daily gain/loss per account
CREATE TABLE daily_gains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    company_token VARCHAR(255) NOT NULL,
    date DATE NOT NULL,

    -- Gain breakdown
    gross_revenue NUMERIC(12,2) DEFAULT 0,
    payment_fees NUMERIC(12,2) DEFAULT 0,
    food_costs NUMERIC(12,2) DEFAULT 0,
    utility_costs NUMERIC(12,2) DEFAULT 0,
    payroll_costs NUMERIC(12,2) DEFAULT 0,
    net_gain NUMERIC(12,2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,

    -- Tracking
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One row per account per day
    CONSTRAINT uq_daily_gains_account_date UNIQUE (company_id, company_token, date)
);

-- Indexes for calendar queries
CREATE INDEX idx_daily_gains_company_date ON daily_gains(company_id, date);
CREATE INDEX idx_daily_gains_token_date ON daily_gains(company_token, date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_daily_gains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_gains_updated_at_trigger
    BEFORE UPDATE ON daily_gains
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_gains_updated_at();

-- Documentation
COMMENT ON TABLE daily_gains IS 'Precomputed daily gain/loss per account, populated by cron job';
COMMENT ON COLUMN daily_gains.company_token IS 'OlaClick account identifier';
COMMENT ON COLUMN daily_gains.net_gain IS 'gross_revenue - payment_fees - food_costs - utility_costs - payroll_costs';
COMMENT ON COLUMN daily_gains.computed_at IS 'When this row was last computed/refreshed';
