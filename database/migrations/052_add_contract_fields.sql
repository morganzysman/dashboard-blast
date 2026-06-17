-- Migration: Work contract generator fields
--
-- Employer legal data is per ACCOUNT (each company_token is a distinct legal
-- entity with its own tax id / legal representative) and country-shaped, so it
-- lives in a generic JSONB blob validated server-side against the country
-- registry (server/config/contractCountries.js). Adding a new country needs
-- no migration.
--
-- Employee contract fields are uniform across countries, so plain columns.

-- ---- company_accounts: country + employer legal data ----------------------
ALTER TABLE company_accounts
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'PE',
  ADD COLUMN IF NOT EXISTS contract_employer_info JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill existing rows to Peru (current tenants); editable per account.
UPDATE company_accounts SET country = 'PE' WHERE country IS NULL;

COMMENT ON COLUMN company_accounts.country IS 'ISO-3166 alpha-2 country of the legal entity; drives contract template + field labels (PE, BR, CO, CL, AR).';
COMMENT ON COLUMN company_accounts.contract_employer_info IS 'Generic employer legal data for contract generation (legal_name, tax_id, address, rep_name, rep_doc_type, rep_doc_number). Keys validated against the country registry.';

-- ---- users: employee contract identity ------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(40),
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN users.document_type IS 'Employee identity document type for contracts (country-specific, e.g. DNI/CE/Pasaporte in PE).';
COMMENT ON COLUMN users.document_number IS 'Employee identity document number for contracts.';
COMMENT ON COLUMN users.address IS 'Employee home address (domicilio) for contracts.';
