-- Migration: Create additional indexes for better performance
-- Performance optimization indexes

CREATE INDEX idx_users_email_active ON users(email) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_token_active ON user_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX idx_push_subs_user_active ON push_subscriptions(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_notification_logs_user_date ON notification_logs(user_id, created_at); 