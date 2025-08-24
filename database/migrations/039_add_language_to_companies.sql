-- Migration: Add language field to companies table

ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS language VARCHAR(2) DEFAULT 'pt';

-- Set default language to Portuguese for existing companies
UPDATE companies 
SET language = 'pt' 
WHERE language IS NULL;

COMMENT ON COLUMN companies.language IS 'Company language code (pt, es, en, fr) - default Portuguese';