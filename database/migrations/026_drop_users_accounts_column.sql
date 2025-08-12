-- Migration: Drop users.accounts JSONB column (moved to company_accounts)

ALTER TABLE users DROP COLUMN IF EXISTS accounts;

-- Drop validation function/constraint if exists
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_accounts_structure;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_accounts_structure(accounts JSONB);
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Clean up helper functions related to accounts if present
DO $$ BEGIN
  DROP FUNCTION IF EXISTS update_account_tokens(UUID, TEXT, TEXT);
EXCEPTION WHEN undefined_function THEN NULL; END $$;

