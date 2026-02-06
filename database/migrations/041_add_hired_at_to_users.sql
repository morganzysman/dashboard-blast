-- Add hired_at column to users table for holiday accrual tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS hired_at DATE NULL;

CREATE INDEX IF NOT EXISTS idx_users_hired_at ON users(hired_at);

COMMENT ON COLUMN users.hired_at IS 'Employee hiring date, used to compute holiday accrual based on tenure';
