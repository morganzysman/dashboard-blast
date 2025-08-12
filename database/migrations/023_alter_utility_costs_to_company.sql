-- Migration: Alter utility_costs to use company_id instead of user_id

-- 1) Add nullable company_id for backfill
ALTER TABLE utility_costs ADD COLUMN company_id UUID NULL REFERENCES companies(id) ON DELETE CASCADE;

-- 2) Backfill company_id from users.company_id using existing user_id
UPDATE utility_costs uc
SET company_id = u.company_id
FROM users u
WHERE uc.user_id = u.id AND uc.company_id IS NULL;

-- 3) Ensure all rows have company_id
-- Some records may not have a matching user (safety). For those, set company_id to a placeholder if needed.
-- But prefer to enforce after ensuring backfill succeeded.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM utility_costs WHERE company_id IS NULL) THEN
    RAISE NOTICE 'utility_costs has rows without company_id; please ensure users.company_id is set before enforcing NOT NULL';
  ELSE
    ALTER TABLE utility_costs ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- 4) Replace unique constraint (user_id, company_token) -> (company_id, company_token)
ALTER TABLE utility_costs DROP CONSTRAINT IF EXISTS unique_user_account;
ALTER TABLE utility_costs
  ADD CONSTRAINT unique_company_account UNIQUE(company_id, company_token);

-- 5) Drop old indexes and create new ones
DROP INDEX IF EXISTS idx_utility_costs_user_id;
DROP INDEX IF EXISTS idx_utility_costs_user_account;
CREATE INDEX IF NOT EXISTS idx_utility_costs_company_id ON utility_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_utility_costs_company_account ON utility_costs(company_id, company_token);

-- 6) Drop user_id column
ALTER TABLE utility_costs DROP COLUMN IF EXISTS user_id;

COMMENT ON COLUMN utility_costs.company_id IS 'Tenant company that owns the account_token row';

