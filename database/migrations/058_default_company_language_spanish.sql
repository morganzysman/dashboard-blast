-- Migration: Default company language is Spanish (es), not Portuguese.
-- Most accounts operate in Spanish-speaking markets (Peru, etc.), so new
-- companies created without an explicit language should default to Spanish.
ALTER TABLE companies
  ALTER COLUMN language SET DEFAULT 'es';

COMMENT ON COLUMN companies.language IS 'Company language code (pt, es, en, fr) - default Spanish';
