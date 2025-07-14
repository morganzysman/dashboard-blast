-- Migration: Insert super-admin user
-- Insert super-admin user for full system access

-- Insert super-admin user (password: superadmin123)
-- Hash generated with bcrypt for 'superadmin123'
INSERT INTO users (
    email, 
    name, 
    role, 
    hashed_password,
    accounts,
    timezone,
    currency,
    currency_symbol
) VALUES (
    'superadmin@dashboard.com',
    'Super Administrator',
    'super-admin',
    '$2b$10$1Xn.R5.Ydc4ppz1ZjgGaBO1RsYC.gPL.IXoGwZnNi0kBbT2land.2',
    '[]'::jsonb,
    'America/Lima',
    'PEN',
    'S/'
) ON CONFLICT (email) DO NOTHING; 