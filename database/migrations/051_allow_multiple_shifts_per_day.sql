-- Migration: Allow multiple shifts per user per weekday (split shifts)
-- Previously employee_shifts had UNIQUE(user_id, company_token, weekday) which
-- prevented assigning more than one shift block on the same day. Dropping it
-- lets admins schedule e.g. a morning and an evening shift on the same weekday.

ALTER TABLE employee_shifts
  DROP CONSTRAINT IF EXISTS employee_shifts_user_id_company_token_weekday_key;

COMMENT ON TABLE employee_shifts IS 'Weekly shifts per user per account (company_token); multiple blocks allowed per weekday';
