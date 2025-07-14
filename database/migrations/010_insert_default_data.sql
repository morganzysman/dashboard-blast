-- Migration: Insert default data
-- Insert default admin user for initial setup

-- Insert default admin user (password: admin123)
-- Hash generated with bcrypt for 'admin123'
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
    'demo@dashboard.com',
    'Demo Admin',
    'admin',
    '$2b$10$YXjR1Ue9tVLgD4Bph.6QuuYjm4eemWml4SrWfKmYdRHuUvyDxO12q',
    '[]'::jsonb,
    'America/Lima',
    'PEN',
    'S/'
) ON CONFLICT (email) DO NOTHING; 