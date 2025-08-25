-- Migration: Add updated_at to push_subscriptions and expand frequency check
-- Purpose: Fix runtime error on updating notification frequency and allow 5-minute option

BEGIN;

-- Add updated_at column if missing
ALTER TABLE push_subscriptions 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill updated_at for existing rows
UPDATE push_subscriptions 
SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

-- Ensure frequency check allows 5-minute option as used by the app
ALTER TABLE push_subscriptions 
  DROP CONSTRAINT IF EXISTS push_subscriptions_notification_frequency_check;

ALTER TABLE push_subscriptions 
  ADD CONSTRAINT push_subscriptions_notification_frequency_check 
  CHECK (notification_frequency IN (5, 30, 60, 240, 480));

COMMIT;


