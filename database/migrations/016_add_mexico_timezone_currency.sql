-- Migration: Add Mexico timezone and Mexican peso currency support
-- Adds support for Mexican clients with proper timezone and currency

-- Add comment to document the supported timezones and currencies
COMMENT ON TABLE users IS 'User accounts with authentication and preferences. Supported timezones: America/Lima (Peru), America/Mexico_City (Mexico), America/New_York (USA), Europe/London (UK), Europe/Paris (France). Supported currencies: PEN (Peruvian Sol), MXN (Mexican Peso), USD (US Dollar), EUR (Euro), GBP (British Pound)';

-- Add comment to timezone column
COMMENT ON COLUMN users.timezone IS 'User timezone. Supported: America/Lima, America/Mexico_City, America/New_York, Europe/London, Europe/Paris';

-- Add comment to currency column  
COMMENT ON COLUMN users.currency IS 'User currency. Supported: PEN (Peruvian Sol), MXN (Mexican Peso), USD (US Dollar), EUR (Euro), GBP (British Pound)';

-- Add comment to currency_symbol column
COMMENT ON COLUMN users.currency_symbol IS 'Currency symbol. PEN=S/, MXN=$, USD=$, EUR=€, GBP=£';

-- Update push_subscriptions table comments
COMMENT ON COLUMN push_subscriptions.timezone IS 'User timezone for notifications. Supported: America/Lima, America/Mexico_City, America/New_York, Europe/London, Europe/Paris';

COMMENT ON COLUMN push_subscriptions.currency IS 'User currency for notifications. Supported: PEN, MXN, USD, EUR, GBP';

COMMENT ON COLUMN push_subscriptions.currency_symbol IS 'Currency symbol for notifications. PEN=S/, MXN=$, USD=$, EUR=€, GBP=£'; 