-- Migration: Support multiple push notification devices per user
-- Removes single device per user limitation

-- Drop the existing unique constraint that limits one device per user
ALTER TABLE push_subscriptions DROP CONSTRAINT push_subscriptions_user_id_key;

-- Add a new unique constraint that allows multiple devices per user
-- but prevents duplicate endpoints for the same user
ALTER TABLE push_subscriptions ADD CONSTRAINT unique_user_endpoint UNIQUE(user_id, endpoint);

-- Add device identifier for better tracking
ALTER TABLE push_subscriptions ADD COLUMN device_name VARCHAR(255) DEFAULT 'Unknown Device';

-- Update index for better performance with multiple devices
DROP INDEX IF EXISTS idx_push_subscriptions_user_id;
CREATE INDEX idx_push_subscriptions_user_devices ON push_subscriptions(user_id, is_active);

-- Add index for endpoint lookups
CREATE INDEX idx_push_subscriptions_endpoint_lookup ON push_subscriptions(endpoint, is_active);

-- Add comments
COMMENT ON CONSTRAINT unique_user_endpoint ON push_subscriptions IS 'Allows multiple devices per user but prevents duplicate endpoints';
COMMENT ON COLUMN push_subscriptions.device_name IS 'Human-readable device name extracted from user agent'; 