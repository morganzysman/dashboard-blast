-- Migration: Link users to a company and map company -> account tokens

-- Add nullable company_id first to backfill
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Company accounts mapping (which company owns which restaurant accounts)
CREATE TABLE company_accounts (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_token VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  PRIMARY KEY(company_id, company_token)
);

CREATE INDEX idx_company_accounts_token ON company_accounts(company_token);

COMMENT ON TABLE company_accounts IS 'Assigns restaurant account tokens to a company.';
