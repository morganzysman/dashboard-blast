-- Migration: Drop recent_notification_events view
-- Remove the recent events view as it's no longer needed

-- Drop the view if it exists
DROP VIEW IF EXISTS recent_notification_events; 