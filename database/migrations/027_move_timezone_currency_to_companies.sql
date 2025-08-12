-- Migration: Move timezone/currency from users to companies

-- 1) Add columns to companies
ALTER TABLE companies 
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS currency_symbol TEXT;

-- 2) Backfill from one of the company's users if available, else defaults
UPDATE companies c SET
  timezone = COALESCE(c.timezone, (
    SELECT u.timezone FROM users u WHERE u.company_id = c.id AND u.timezone IS NOT NULL LIMIT 1
  ), 'America/Lima'),
  currency = COALESCE(c.currency, (
    SELECT u.currency FROM users u WHERE u.company_id = c.id AND u.currency IS NOT NULL LIMIT 1
  ), 'PEN'),
  currency_symbol = COALESCE(c.currency_symbol, (
    SELECT u.currency_symbol FROM users u WHERE u.company_id = c.id AND u.currency_symbol IS NOT NULL LIMIT 1
  ), 'S/');

-- 3) Adjust dependent views, then drop columns from users
DROP VIEW IF EXISTS active_users_with_sessions;

-- Recreate view reading tz/currency from companies
CREATE VIEW active_users_with_sessions AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.last_login,
    c.timezone,
    c.currency,
    c.currency_symbol,
    COALESCE(s.session_count, 0) as active_sessions,
    CASE WHEN ps.user_id IS NOT NULL THEN TRUE ELSE FALSE END as has_push_subscription
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count
    FROM user_sessions 
    WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
    GROUP BY user_id
) s ON u.id = s.user_id
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id AND ps.is_active = TRUE
WHERE u.is_active = TRUE;

-- Now drop columns from users (they are now on companies)
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
ALTER TABLE users DROP COLUMN IF EXISTS currency;
ALTER TABLE users DROP COLUMN IF EXISTS currency_symbol;

COMMENT ON COLUMN companies.timezone IS 'Default timezone for company tenants';
COMMENT ON COLUMN companies.currency IS 'Default currency code (e.g., PEN, USD)';
COMMENT ON COLUMN companies.currency_symbol IS 'Currency symbol for display (e.g., S/, $, €)';

