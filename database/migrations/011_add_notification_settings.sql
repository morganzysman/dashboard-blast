-- Migration: Add notification settings to push_subscriptions table
-- Adds frequency settings for push notifications

-- Add notification frequency setting to push_subscriptions table
ALTER TABLE push_subscriptions 
ADD COLUMN notification_frequency INTEGER DEFAULT 30 CHECK (notification_frequency IN (30, 60, 240, 480));

-- Add last notification time tracking for frequency control
ALTER TABLE push_subscriptions 
ADD COLUMN last_notification_time TIMESTAMP DEFAULT NULL;

-- Add index for efficient frequency queries
CREATE INDEX idx_push_subscriptions_frequency ON push_subscriptions(notification_frequency, last_notification_time);

-- Add comment for the frequency values
COMMENT ON COLUMN push_subscriptions.notification_frequency IS 'Notification frequency in minutes: 30=30min, 60=1h, 240=4h, 480=8h'; 