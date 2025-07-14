-- Migration: Create utility functions
-- Functions for session cleanup and log management

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_active = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO notification_logs (user_id, event_type, message, success, created_at)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'session_cleanup',
        'Cleaned ' || deleted_count || ' expired sessions',
        TRUE,
        CURRENT_TIMESTAMP
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old notification logs (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 