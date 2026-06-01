-- Persistent "trophy case" for reached achievements.
-- A daily cron evaluates stored daily_gains and records each goal the moment it
-- is reached. Rows are permanent: a goal hit on a great day stays earned even
-- though that day's live numbers reset the next morning.
CREATE TABLE achievements_unlocked (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- 'account' (per location) or 'company' (all locations combined)
    scope VARCHAR(16) NOT NULL,
    -- OlaClick account identifier; '' (empty) for company-scope achievements so
    -- the UNIQUE constraint below dedupes them (NULLs would be treated distinct).
    company_token VARCHAR(255) NOT NULL DEFAULT '',

    -- Matches the catalog definition id (e.g. 'acc-d-sales-2k')
    achievement_id VARCHAR(64) NOT NULL,
    period VARCHAR(16) NOT NULL,        -- 'daily' | 'monthly'
    -- The period this unlock belongs to: 'YYYY-MM-DD' for daily goals,
    -- 'YYYY-MM' for monthly goals. Keeps the cron idempotent and lets us count
    -- how many times a daily goal has been earned.
    period_key VARCHAR(16) NOT NULL,

    -- Value that triggered the unlock (revenue / net gain / orders / streak len)
    unlock_value NUMERIC(14,2) DEFAULT 0,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One unlock per goal per period (per account for account-scope; '' token
    -- collapses all company-scope rows for the same goal+period).
    CONSTRAINT uq_achievement_unlock UNIQUE (company_id, scope, company_token, achievement_id, period_key)
);

CREATE INDEX idx_achievements_company ON achievements_unlocked(company_id, scope);
CREATE INDEX idx_achievements_lookup ON achievements_unlocked(company_id, scope, company_token, achievement_id);

COMMENT ON TABLE achievements_unlocked IS 'Permanent record of reached goals; populated by the achievements cron from daily_gains';
COMMENT ON COLUMN achievements_unlocked.period_key IS 'YYYY-MM-DD for daily goals, YYYY-MM for monthly goals';
COMMENT ON COLUMN achievements_unlocked.unlock_value IS 'Metric value at the moment the goal was reached';
