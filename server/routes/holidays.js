import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pool } from '../database.js';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────

const DAYS_PER_YEAR = 15;
const MONTHLY_ACCRUAL = DAYS_PER_YEAR / 12; // 1.25

/**
 * Compute full months of service between hiredAt and asOfDate.
 * Only counts fully completed months.
 */
function monthsOfService(hiredAt, asOfDate) {
  if (!hiredAt) return 0;
  const hired = new Date(hiredAt);
  const now = new Date(asOfDate);
  if (hired > now) return 0;

  let months = (now.getFullYear() - hired.getFullYear()) * 12 + (now.getMonth() - hired.getMonth());
  // If we haven't reached the day of the month yet, subtract one
  if (now.getDate() < hired.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

/**
 * Compute accrued holiday days for an employee as of a given date.
 */
function computeAccrued(hiredAt, asOfDate = new Date()) {
  const months = monthsOfService(hiredAt, asOfDate);
  return parseFloat((months * MONTHLY_ACCRUAL).toFixed(2));
}

// ─── GET /api/holidays/summary ────────────────────────────

router.get('/summary', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const companyId = req.query.companyId || req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Company ID is required' });
    }

    // Fetch employees for the company
    const employeesResult = await pool.query(
      `SELECT id, name, email, hired_at, is_active
       FROM users
       WHERE company_id = $1 AND role = 'employee' AND is_active = TRUE
       ORDER BY name ASC`,
      [companyId]
    );

    // Pre-aggregate taken days per employee
    const takenResult = await pool.query(
      `SELECT employee_id, SUM(days) as taken
       FROM holiday_requests
       WHERE company_id = $1 AND status = 'approved'
       GROUP BY employee_id`,
      [companyId]
    );

    const takenMap = new Map();
    for (const row of takenResult.rows) {
      takenMap.set(row.employee_id, parseFloat(row.taken));
    }

    const today = new Date();
    const employees = employeesResult.rows.map(emp => {
      const months = monthsOfService(emp.hired_at, today);
      const accrued = computeAccrued(emp.hired_at, today);
      const taken = takenMap.get(emp.id) || 0;
      const balance = parseFloat((accrued - taken).toFixed(2));

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        hired_at: emp.hired_at,
        months_of_service: months,
        accrued,
        taken,
        balance,
        has_hired_date: !!emp.hired_at
      };
    });

    res.json({ success: true, employees, days_per_year: DAYS_PER_YEAR });
  } catch (error) {
    console.error('Error fetching holiday summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holiday summary' });
  }
});

// ─── GET /api/holidays/employees/:employeeId ──────────────

router.get('/employees/:employeeId', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.query.companyId || req.user.companyId;

    // Fetch employee
    const empResult = await pool.query(
      `SELECT id, name, email, hired_at FROM users WHERE id = $1 AND company_id = $2`,
      [employeeId, companyId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const emp = empResult.rows[0];

    // Fetch holiday requests
    const requestsResult = await pool.query(
      `SELECT hr.id, hr.start_date, hr.end_date, hr.days, hr.note, hr.status, hr.created_at,
              u.name as created_by_name
       FROM holiday_requests hr
       LEFT JOIN users u ON hr.created_by = u.id
       WHERE hr.employee_id = $1 AND hr.company_id = $2
       ORDER BY hr.start_date DESC`,
      [employeeId, companyId]
    );

    const today = new Date();
    const months = monthsOfService(emp.hired_at, today);
    const accrued = computeAccrued(emp.hired_at, today);
    const taken = requestsResult.rows
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.days), 0);
    const balance = parseFloat((accrued - taken).toFixed(2));

    res.json({
      success: true,
      employee: {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        hired_at: emp.hired_at,
        months_of_service: months,
        accrued,
        taken,
        balance
      },
      requests: requestsResult.rows
    });
  } catch (error) {
    console.error('Error fetching employee holidays:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee holiday history' });
  }
});

// ─── POST /api/holidays/requests ──────────────────────────

router.post('/requests', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { employee_id, start_date, end_date, days, note } = req.body;
    const companyId = req.body.company_id || req.user.companyId;

    // Validate required fields
    if (!employee_id || !start_date || !end_date || !days) {
      return res.status(400).json({ success: false, error: 'employee_id, start_date, end_date, and days are required' });
    }

    if (parseFloat(days) <= 0) {
      return res.status(400).json({ success: false, error: 'Days must be greater than 0' });
    }

    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ success: false, error: 'Start date must be before or equal to end date' });
    }

    // Verify employee exists and belongs to the company
    const empResult = await pool.query(
      `SELECT id, hired_at FROM users WHERE id = $1 AND company_id = $2 AND role = 'employee'`,
      [employee_id, companyId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Employee not found in this company' });
    }

    const emp = empResult.rows[0];

    // Compute current balance
    const today = new Date();
    const accrued = computeAccrued(emp.hired_at, today);

    const takenResult = await pool.query(
      `SELECT COALESCE(SUM(days), 0) as taken
       FROM holiday_requests
       WHERE employee_id = $1 AND company_id = $2 AND status = 'approved'`,
      [employee_id, companyId]
    );
    const taken = parseFloat(takenResult.rows[0].taken);
    const currentBalance = parseFloat((accrued - taken).toFixed(2));

    // Enforce non-negative balance
    if (parseFloat(days) > currentBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Available: ${currentBalance} days, requested: ${days} days`
      });
    }

    // Insert the holiday request
    const insertResult = await pool.query(
      `INSERT INTO holiday_requests (employee_id, company_id, start_date, end_date, days, note, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
       RETURNING *`,
      [employee_id, companyId, start_date, end_date, parseFloat(days), note || null, req.user.id]
    );

    res.status(201).json({ success: true, request: insertResult.rows[0] });
  } catch (error) {
    console.error('Error creating holiday request:', error);
    res.status(500).json({ success: false, error: 'Failed to create holiday request' });
  }
});

// ─── DELETE /api/holidays/requests/:requestId ─────────────

router.delete('/requests/:requestId', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const companyId = req.query.companyId || req.user.companyId;

    const result = await pool.query(
      `DELETE FROM holiday_requests WHERE id = $1 AND company_id = $2 RETURNING *`,
      [requestId, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Holiday request not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting holiday request:', error);
    res.status(500).json({ success: false, error: 'Failed to delete holiday request' });
  }
});

export default router;
