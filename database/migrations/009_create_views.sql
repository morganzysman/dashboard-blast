-- Migration: Create views for easier querying
-- Database views for simplified data access

-- Active users with session count
CREATE VIEW active_users_with_sessions AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.last_login,
    u.timezone,
    u.currency,
    u.currency_symbol,
    COALESCE(s.session_count, 0) as active_sessions,
    CASE WHEN ps.user_id IS NOT NULL THEN TRUE ELSE FALSE END as has_push_subscription
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count
    FROM user_sessions 
    WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
    GROUP BY user_id
) s ON u.id = s.user_id
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id AND ps.is_active = TRUE
WHERE u.is_active = TRUE;

-- Push subscription stats
CREATE VIEW push_subscription_stats AS
SELECT 
    u.email,
    u.name,
    ps.subscribed_at,
    ps.last_notification_sent,
    ps.notification_count,
    ps.error_count,
    ps.last_error,
    ps.last_error_at,
    ps.is_active
FROM push_subscriptions ps
JOIN users u ON ps.user_id = u.id
WHERE ps.is_active = TRUE; 