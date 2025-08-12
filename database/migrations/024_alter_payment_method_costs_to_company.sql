-- Migration: Alter payment_method_costs to use company_id instead of user_id

-- 1) Add nullable company_id for backfill
ALTER TABLE payment_method_costs ADD COLUMN company_id UUID NULL REFERENCES companies(id) ON DELETE CASCADE;

-- 2) Backfill company_id from users.company_id using existing user_id
UPDATE payment_method_costs pmc
SET company_id = u.company_id
FROM users u
WHERE pmc.user_id = u.id AND pmc.company_id IS NULL;

-- 3) Ensure all rows have company_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM payment_method_costs WHERE company_id IS NULL) THEN
    RAISE NOTICE 'payment_method_costs has rows without company_id; please ensure users.company_id is set before enforcing NOT NULL';
  ELSE
    ALTER TABLE payment_method_costs ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- 4) Replace unique constraint (user_id, company_token, payment_method_code) -> (company_id, company_token, payment_method_code)
ALTER TABLE payment_method_costs DROP CONSTRAINT IF EXISTS unique_user_account_payment_method;
ALTER TABLE payment_method_costs
  ADD CONSTRAINT unique_company_account_payment_method UNIQUE(company_id, company_token, payment_method_code);

-- 5) Drop old indexes and create new ones
DROP INDEX IF EXISTS idx_payment_method_costs_user_id;
DROP INDEX IF EXISTS idx_payment_method_costs_user_account;
CREATE INDEX IF NOT EXISTS idx_payment_method_costs_company_id ON payment_method_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_costs_company_account ON payment_method_costs(company_id, company_token);

-- 6) Drop user_id column
ALTER TABLE payment_method_costs DROP COLUMN IF EXISTS user_id;

COMMENT ON COLUMN payment_method_costs.company_id IS 'Tenant company that owns the account_token row';

