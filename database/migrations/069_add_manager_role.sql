-- Migration: add the 'manager' role.
--
-- A manager is a company-scoped supervisor sitting between admin and employee.
-- They configure the training-evidence catalogue and review what employees
-- submit, but they get none of the financial/analytics surface an admin has.
-- Managers are still staff, so they keep the employee self-service pages
-- (clock, timesheet, contracts).

ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('super-admin', 'admin', 'manager', 'employee'));

-- job_type (kitchen | waiter) applies to managers too: a kitchen manager should
-- be able to receive kitchen-targeted training prompts on their own shifts.
COMMENT ON COLUMN users.job_type IS 'Operational job role used for staff categorization and training-evidence targeting: kitchen (cook) or waiter; NULL when not categorised.';
