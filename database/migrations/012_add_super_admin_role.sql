-- Migration: Add super-admin role
-- Adds super-admin role to the valid roles constraint

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT valid_role;

-- Add the new constraint with super-admin role
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('super-admin', 'admin', 'user', 'viewer'));

-- Update comments to reflect the new role hierarchy
COMMENT ON COLUMN users.role IS 'User role: super-admin (full system access), admin (manage accounts), user (view assigned accounts), viewer (read-only)'; 