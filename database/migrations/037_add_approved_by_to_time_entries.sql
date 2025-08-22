-- Migration: Add approved_by column to time_entries for approval workflow

-- Add approved_by column to track which manager approved the entry
ALTER TABLE time_entries 
ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for filtering pending approvals
CREATE INDEX idx_time_entries_pending_approval 
ON time_entries(company_token, approved_by) 
WHERE approved_by IS NULL AND clock_out_at IS NOT NULL;

-- Add index for approved entries lookup
CREATE INDEX idx_time_entries_approved 
ON time_entries(approved_by) 
WHERE approved_by IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN time_entries.approved_by IS 'Manager/admin user who approved this time entry';