-- Create holiday_requests table for tracking employee holiday/vacation usage
CREATE TABLE holiday_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Holiday details
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days NUMERIC(6,2) NOT NULL CHECK (days > 0),
    note TEXT,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('approved', 'cancelled')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_holiday_date_range CHECK (end_date >= start_date)
);

-- Indexes for performance
CREATE INDEX idx_holiday_requests_employee_status ON holiday_requests(employee_id, status);
CREATE INDEX idx_holiday_requests_employee_start ON holiday_requests(employee_id, start_date);
CREATE INDEX idx_holiday_requests_company_id ON holiday_requests(company_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_holiday_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER holiday_requests_updated_at_trigger
    BEFORE UPDATE ON holiday_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_holiday_requests_updated_at();

-- Documentation
COMMENT ON TABLE holiday_requests IS 'Ledger of holiday/vacation days taken by employees';
COMMENT ON COLUMN holiday_requests.employee_id IS 'The employee who took the holiday';
COMMENT ON COLUMN holiday_requests.company_id IS 'Company context for the holiday';
COMMENT ON COLUMN holiday_requests.start_date IS 'First day of the holiday period';
COMMENT ON COLUMN holiday_requests.end_date IS 'Last day of the holiday period';
COMMENT ON COLUMN holiday_requests.days IS 'Number of days deducted (supports half-days)';
COMMENT ON COLUMN holiday_requests.note IS 'Optional note or reason for the holiday';
COMMENT ON COLUMN holiday_requests.status IS 'Current status: approved or cancelled';
COMMENT ON COLUMN holiday_requests.created_by IS 'Admin who registered this holiday';
