-- Migration: Make user_id nullable in notification_logs for system events
-- Allows logging of system events without requiring a valid user

-- Make user_id nullable
ALTER TABLE notification_logs ALTER COLUMN user_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL values
ALTER TABLE notification_logs DROP CONSTRAINT notification_logs_user_id_fkey;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add check constraint to ensure system events use NULL user_id
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_system_events_check 
    CHECK (
        (user_id IS NULL AND event_type IN ('database_migrations', 'database_migrations_error', 'database_cleanup', 'database_cleanup_error', 'system_startup', 'system_shutdown'))
        OR 
        (user_id IS NOT NULL AND event_type NOT IN ('database_migrations', 'database_migrations_error', 'database_cleanup', 'database_cleanup_error', 'system_startup', 'system_shutdown'))
    );

-- Add comment to explain the nullable user_id
COMMENT ON COLUMN notification_logs.user_id IS 'User ID for user events, NULL for system events like migrations and cleanup'; 