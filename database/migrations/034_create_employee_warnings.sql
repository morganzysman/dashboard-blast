-- Create employee warnings table
-- This table stores warnings issued to employees by administrators

CREATE TABLE employee_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Warning details
    warning_category VARCHAR(50) NOT NULL,
    warning_motive VARCHAR(255) NOT NULL,
    description TEXT,
    severity_level VARCHAR(20) DEFAULT 'low' CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Tracking
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'disputed', 'expired')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_employee_warnings_employee_id ON employee_warnings(employee_id);
CREATE INDEX idx_employee_warnings_company_id ON employee_warnings(company_id);
CREATE INDEX idx_employee_warnings_issued_by ON employee_warnings(issued_by);
CREATE INDEX idx_employee_warnings_issued_at ON employee_warnings(issued_at);
CREATE INDEX idx_employee_warnings_status ON employee_warnings(status);

-- Add a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_warnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_warnings_updated_at_trigger
    BEFORE UPDATE ON employee_warnings
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_warnings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE employee_warnings IS 'Stores warnings issued to employees for various infractions';
COMMENT ON COLUMN employee_warnings.employee_id IS 'The employee who received the warning';
COMMENT ON COLUMN employee_warnings.issued_by IS 'The admin/manager who issued the warning';
COMMENT ON COLUMN employee_warnings.company_id IS 'Company context for the warning';
COMMENT ON COLUMN employee_warnings.warning_category IS 'Category of the warning (attendance, conduct, performance, etc.)';
COMMENT ON COLUMN employee_warnings.warning_motive IS 'Specific reason for the warning';
COMMENT ON COLUMN employee_warnings.description IS 'Detailed description of the incident';
COMMENT ON COLUMN employee_warnings.severity_level IS 'Severity level of the warning';
COMMENT ON COLUMN employee_warnings.acknowledged_at IS 'When the employee acknowledged reading the warning';
COMMENT ON COLUMN employee_warnings.status IS 'Current status of the warning';

-- Create a view for active warnings with employee details
CREATE VIEW active_employee_warnings AS
SELECT 
    ew.*,
    emp.name as employee_name,
    emp.email as employee_email,
    admin.name as issued_by_name,
    c.name as company_name
FROM employee_warnings ew
JOIN users emp ON ew.employee_id = emp.id
JOIN users admin ON ew.issued_by = admin.id
JOIN companies c ON ew.company_id = c.id
WHERE ew.status = 'active';

COMMENT ON VIEW active_employee_warnings IS 'View showing active warnings with employee and issuer details';
