-- Migration: Add comments for documentation
-- Add table and column comments for better documentation

-- Table comments
COMMENT ON TABLE users IS 'User accounts with authentication and preferences';
COMMENT ON TABLE user_sessions IS 'Active user sessions with expiration tracking';
COMMENT ON TABLE push_subscriptions IS 'Push notification subscriptions per user';
COMMENT ON TABLE notification_logs IS 'Event logging for notifications and debugging';

-- Column comments
COMMENT ON COLUMN users.accounts IS 'JSON array of OlaClick account access permissions';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS 'Public key for message encryption';
COMMENT ON COLUMN push_subscriptions.auth_key IS 'Authentication secret for push messages'; 