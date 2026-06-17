-- Migration: Add tenant-level country to companies (drives feature gating)
--
-- The work-contract feature stores a per-account (per legal entity) country on
-- company_accounts. This adds a tenant-level country on the companies row,
-- set by the super-admin at company creation, used to decide which optional
-- feature modules are available to the tenant (see server/config/featureModules.js).
-- ISO-3166-1 alpha-2. Default Peru to match existing timezone/currency defaults.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'PE';

UPDATE companies SET country = 'PE' WHERE country IS NULL;

COMMENT ON COLUMN companies.country IS 'ISO-3166-1 alpha-2 country code set at company creation; gates which optional feature modules are available to the tenant.';
