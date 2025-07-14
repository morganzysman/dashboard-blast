-- Migration: Update users accounts structure to include API tokens
-- Each account in the accounts array will now include API tokens

-- First, create a function to validate the accounts structure
CREATE OR REPLACE FUNCTION validate_accounts_structure(accounts JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if accounts is an array
  IF NOT jsonb_typeof(accounts) = 'array' THEN
    RETURN FALSE;
  END IF;

  -- Check each account object has required fields
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(accounts) as account
    WHERE NOT (
      account ? 'account_name' AND
      account ? 'company_token' AND
      account ? 'api_token' AND
      account ? 'is_active' AND
      (account->>'account_name')::text IS NOT NULL AND
      (account->>'company_token')::text IS NOT NULL AND
      (account->>'api_token')::text IS NOT NULL AND
      (account->>'is_active')::boolean IS NOT NULL
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Add constraint to validate accounts structure
ALTER TABLE users
ADD CONSTRAINT valid_accounts_structure
CHECK (validate_accounts_structure(accounts));

-- Create a function to safely update account tokens
CREATE OR REPLACE FUNCTION update_account_tokens(
  p_user_id UUID,
  p_company_token TEXT,
  p_api_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_accounts JSONB;
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Get current accounts
  SELECT accounts INTO v_accounts
  FROM users
  WHERE id = p_user_id;
  
  -- Update the specific account's API token
  SELECT jsonb_agg(
    CASE
      WHEN (account->>'company_token')::text = p_company_token
      THEN jsonb_set(
        account,
        '{api_token}',
        to_jsonb(p_api_token)
      )
      ELSE account
    END
  )
  INTO v_accounts
  FROM jsonb_array_elements(v_accounts) account;
  
  -- Update the user's accounts
  UPDATE users
  SET accounts = v_accounts
  WHERE id = p_user_id;
  
  RETURN v_accounts;
END;
$$ LANGUAGE plpgsql;

-- Example account structure:
COMMENT ON COLUMN users.accounts IS 'Array of account objects with structure:
[{
  "account_name": "string", -- Account display name
  "company_token": "string", -- Company identifier token
  "api_token": "string",    -- API token for data fetching
  "is_active": boolean,     -- Whether the account is active
  "created_at": "string",   -- ISO date string
  "updated_at": "string"    -- ISO date string
}]';

-- Update existing accounts to add missing fields
UPDATE users
SET accounts = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'account_name', COALESCE(acc->>'name', acc->>'account_name', 'Unknown Account'),
      'company_token', COALESCE(acc->>'company_token', ''),
      'api_token', COALESCE(acc->>'api_token', ''),
      'is_active', COALESCE((acc->>'is_active')::boolean, true),
      'created_at', COALESCE(acc->>'created_at', CURRENT_TIMESTAMP::text),
      'updated_at', COALESCE(acc->>'updated_at', CURRENT_TIMESTAMP::text)
    )
  )
  FROM jsonb_array_elements(accounts) acc
)
WHERE jsonb_array_length(accounts) > 0; 