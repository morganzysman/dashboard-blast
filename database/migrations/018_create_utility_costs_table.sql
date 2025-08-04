-- Migration: Create utility_costs table
-- Store monthly utility costs per account for rentability calculations

CREATE TABLE utility_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_token VARCHAR(255) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    
    -- Monthly costs in account's local currency
    rent_monthly DECIMAL(10,2) DEFAULT 0.00,
    electricity_monthly DECIMAL(10,2) DEFAULT 0.00,
    water_monthly DECIMAL(10,2) DEFAULT 0.00,
    internet_monthly DECIMAL(10,2) DEFAULT 0.00,
    gas_monthly DECIMAL(10,2) DEFAULT 0.00,
    insurance_monthly DECIMAL(10,2) DEFAULT 0.00,
    maintenance_monthly DECIMAL(10,2) DEFAULT 0.00,
    staff_monthly DECIMAL(10,2) DEFAULT 0.00,
    marketing_monthly DECIMAL(10,2) DEFAULT 0.00,
    other_monthly DECIMAL(10,2) DEFAULT 0.00,
    
    -- Auto-calculated daily costs (monthly / 30)
    rent_daily DECIMAL(10,2) GENERATED ALWAYS AS (rent_monthly / 30) STORED,
    electricity_daily DECIMAL(10,2) GENERATED ALWAYS AS (electricity_monthly / 30) STORED,
    water_daily DECIMAL(10,2) GENERATED ALWAYS AS (water_monthly / 30) STORED,
    internet_daily DECIMAL(10,2) GENERATED ALWAYS AS (internet_monthly / 30) STORED,
    gas_daily DECIMAL(10,2) GENERATED ALWAYS AS (gas_monthly / 30) STORED,
    insurance_daily DECIMAL(10,2) GENERATED ALWAYS AS (insurance_monthly / 30) STORED,
    maintenance_daily DECIMAL(10,2) GENERATED ALWAYS AS (maintenance_monthly / 30) STORED,
    staff_daily DECIMAL(10,2) GENERATED ALWAYS AS (staff_monthly / 30) STORED,
    marketing_daily DECIMAL(10,2) GENERATED ALWAYS AS (marketing_monthly / 30) STORED,
    other_daily DECIMAL(10,2) GENERATED ALWAYS AS (other_monthly / 30) STORED,
    
    -- Total calculated costs
    total_monthly DECIMAL(10,2) GENERATED ALWAYS AS (
        rent_monthly + electricity_monthly + water_monthly + internet_monthly + 
        gas_monthly + insurance_monthly + maintenance_monthly + staff_monthly + 
        marketing_monthly + other_monthly
    ) STORED,
    total_daily DECIMAL(10,2) GENERATED ALWAYS AS (
        (rent_monthly + electricity_monthly + water_monthly + internet_monthly + 
         gas_monthly + insurance_monthly + maintenance_monthly + staff_monthly + 
         marketing_monthly + other_monthly) / 30
    ) STORED,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_user_account UNIQUE(user_id, company_token),
    CONSTRAINT positive_costs CHECK (
        rent_monthly >= 0 AND electricity_monthly >= 0 AND water_monthly >= 0 AND 
        internet_monthly >= 0 AND gas_monthly >= 0 AND insurance_monthly >= 0 AND 
        maintenance_monthly >= 0 AND staff_monthly >= 0 AND marketing_monthly >= 0 AND 
        other_monthly >= 0
    )
);

-- Add indexes for better query performance
CREATE INDEX idx_utility_costs_user_id ON utility_costs(user_id);
CREATE INDEX idx_utility_costs_company_token ON utility_costs(company_token);
CREATE INDEX idx_utility_costs_user_account ON utility_costs(user_id, company_token);

-- Trigger to automatically update updated_at for utility_costs
CREATE TRIGGER update_utility_costs_updated_at BEFORE UPDATE ON utility_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table comments
COMMENT ON TABLE utility_costs IS 'Monthly utility and operational costs per account for rentability analysis';
COMMENT ON COLUMN utility_costs.rent_monthly IS 'Monthly rent cost';
COMMENT ON COLUMN utility_costs.electricity_monthly IS 'Monthly electricity/power cost';
COMMENT ON COLUMN utility_costs.water_monthly IS 'Monthly water cost';
COMMENT ON COLUMN utility_costs.internet_monthly IS 'Monthly internet/telecom cost';
COMMENT ON COLUMN utility_costs.gas_monthly IS 'Monthly gas cost';
COMMENT ON COLUMN utility_costs.insurance_monthly IS 'Monthly insurance cost';
COMMENT ON COLUMN utility_costs.maintenance_monthly IS 'Monthly maintenance cost';
COMMENT ON COLUMN utility_costs.staff_monthly IS 'Monthly staff/payroll cost';
COMMENT ON COLUMN utility_costs.marketing_monthly IS 'Monthly marketing/advertising cost';
COMMENT ON COLUMN utility_costs.other_monthly IS 'Other monthly operational costs';
COMMENT ON COLUMN utility_costs.total_daily IS 'Auto-calculated total daily costs (total_monthly / 30)';