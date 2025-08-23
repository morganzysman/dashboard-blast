-- Migration: Optimize indexes for common time_entries queries
-- Rationale:
-- 1) Admin calendar/payroll fetch filters by (company_token, clock_in_at range)
--    and sometimes by user_id, and orders by (user_id, clock_in_at).
--    Add a composite index to accelerate per-user scans within a company
--    while supporting the ORDER BY pattern.
-- 2) Pending approvals listing filters by company, requires clocked-out,
--    not approved, and not paid, and orders by clock_out_at DESC. A partial
--    index targeting exactly these rows avoids scanning the entire table.

-- Accelerate queries that filter by company and user, and sort by clock_in_at
CREATE INDEX IF NOT EXISTS idx_time_entries_company_user_clockin
  ON time_entries(company_token, user_id, clock_in_at);

-- Speed up pending approvals list per company
CREATE INDEX IF NOT EXISTS idx_time_entries_company_pending
  ON time_entries(company_token, clock_out_at DESC)
  WHERE clock_out_at IS NOT NULL AND approved_by IS NULL AND paid = FALSE;

COMMENT ON INDEX idx_time_entries_company_user_clockin IS 'Supports filtering by company+user and ordering by clock_in_at';
COMMENT ON INDEX idx_time_entries_company_pending IS 'Targets pending approvals (clocked out, not approved, unpaid) ordered by latest clock_out_at';


