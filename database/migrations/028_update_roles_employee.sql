-- Migration: Update roles to use 'employee' and drop 'user'/'viewer'

-- 1) Update existing rows: map old roles to new set
UPDATE users SET role = 'employee' WHERE role IN ('user', 'viewer');

-- 2) Replace CHECK constraint to allow only the new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('super-admin', 'admin', 'employee'));

COMMENT ON COLUMN users.role IS 'User role: super-admin (full system access), admin (tenant admin), employee (regular employee)';


