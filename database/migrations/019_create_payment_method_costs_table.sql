-- Migration: Create payment_method_costs table
-- Store payment method costs per account for more accurate gain calculations

CREATE TABLE payment_method_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_token VARCHAR(255) NOT NULL,
    payment_method_code VARCHAR(100) NOT NULL,
    
    -- Cost structure (percentage + fixed fee)
    cost_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- e.g., 4.00 for 4%
    fixed_cost DECIMAL(10,2) DEFAULT 0.00, -- e.g., fixed fee per transaction
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_user_account_payment_method UNIQUE(user_id, company_token, payment_method_code),
    CONSTRAINT positive_percentage CHECK (cost_percentage >= 0 AND cost_percentage <= 100),
    CONSTRAINT positive_fixed_cost CHECK (fixed_cost >= 0)
);

-- Add indexes for better query performance
CREATE INDEX idx_payment_method_costs_user_id ON payment_method_costs(user_id);
CREATE INDEX idx_payment_method_costs_company_token ON payment_method_costs(company_token);
CREATE INDEX idx_payment_method_costs_user_account ON payment_method_costs(user_id, company_token);

-- Trigger to automatically update updated_at for payment_method_costs
CREATE TRIGGER update_payment_method_costs_updated_at BEFORE UPDATE ON payment_method_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table comments
COMMENT ON TABLE payment_method_costs IS 'Payment method processing costs per account for accurate gain calculations';
COMMENT ON COLUMN payment_method_costs.cost_percentage IS 'Processing cost as percentage (e.g., 4.00 for 4%)';
COMMENT ON COLUMN payment_method_costs.fixed_cost IS 'Fixed cost per transaction in account currency';

-- Insert default payment method costs (common industry standards)
-- These are just examples, users can customize per account
INSERT INTO payment_method_costs (user_id, company_token, payment_method_code, cost_percentage, fixed_cost)
SELECT 
    u.id as user_id,
    acc.value->>'company_token' as company_token,
    pm.payment_method_code,
    pm.default_percentage,
    pm.default_fixed_cost
FROM users u
CROSS JOIN jsonb_array_elements(u.accounts) acc
CROSS JOIN (VALUES
    ('cash', 0.00, 0.00),
    ('card', 3.50, 0.30),
    ('credit_card', 3.80, 0.35),
    ('debit_card', 2.50, 0.25),
    ('visa', 3.20, 0.30),
    ('mastercard', 3.20, 0.30),
    ('amex', 4.50, 0.40),
    ('yape', 1.50, 0.10),
    ('plin', 1.80, 0.15),
    ('transfer', 0.50, 0.05),
    ('bitcoin', 8.00, 1.00),
    ('paypal', 4.20, 0.30),
    ('mercado_pago', 6.40, 0.50),
    ('other', 2.00, 0.20)
) pm(payment_method_code, default_percentage, default_fixed_cost)
WHERE u.is_active = TRUE 
  AND jsonb_array_length(u.accounts) > 0;