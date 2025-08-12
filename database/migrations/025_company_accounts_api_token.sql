-- Migration: Add api_token to company_accounts and index

ALTER TABLE company_accounts ADD COLUMN api_token TEXT;

CREATE INDEX IF NOT EXISTS idx_company_accounts_company ON company_accounts(company_id);

COMMENT ON COLUMN company_accounts.api_token IS 'Auth token used to access OlaClick for this account token';

