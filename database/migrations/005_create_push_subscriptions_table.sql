-- Migration: Create push_subscriptions table
-- Push notification subscriptions per user

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Push subscription data
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- User preferences (cached from users table)
    timezone VARCHAR(50) DEFAULT 'America/Lima',
    currency VARCHAR(10) DEFAULT 'PEN',
    currency_symbol VARCHAR(10) DEFAULT 'S/',
    
    -- Metadata
    user_agent TEXT,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_notification_sent TIMESTAMP,
    notification_count INTEGER DEFAULT 0,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT TRUE,
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMP,
    
    -- Unique constraint per user
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX idx_push_subscriptions_last_notification_sent ON push_subscriptions(last_notification_sent); 