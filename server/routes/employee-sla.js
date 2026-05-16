import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { pool } from '../database.js'
import { computeAndStoreEmployeeSlaForDay } from '../services/employeeSlaService.js'

const router = Router()

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseDate(value, fallback) {
  if (!value) return fallback
  const s = String(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback
  return s
}

function getTodayInTimezone(timezone) {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'America/Lima' })
}

async function getCompanyAccountsForUser(req, companyTokenFilter) {
  if (req.user.role === 'super-admin') {
    if (companyTokenFilter) {
      const r = await pool.query(
        'SELECT company_id, company_token, account_name FROM company_accounts WHERE company_token = $1',
        [companyTokenFilter]
      )
      return r.rows
    }
    const r = await pool.query(
      'SELECT company_id, company_token, account_name FROM company_accounts ORDER BY account_name'
    )
    return r.rows
  }
  if (!req.user.companyId) return []
  const params = [req.user.companyId]
  let where = 'WHERE company_id = $1'
  if (companyTokenFilter) {
    params.push(companyTokenFilter)
    where += ` AND company_token = $${params.length}`
  }
  const r = await pool.query(
    `SELECT company_id, company_token, account_name FROM company_accounts ${where} ORDER BY account_name`,
    params
  )
  return r.rows
}

/* -------------------------------------------------------------------------- */
/* leaderboard                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/employee-sla/leaderboard
 * Query: start_date, end_date (YYYY-MM-DD, defaults to today/today), company_token (optional)
 *
 * Returns one row per (kitchen) user across the requested window with aggregated SLA
 * counters. Admins see only users in their company; super-admins see all.
 */
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const today = getTodayInTimezone(req.user.userTimezone)
    const startDate = parseDate(req.query.start_date, today)
    const endDate = parseDate(req.query.end_date, today)
    const companyToken = req.query.company_token || null

    const accounts = await getCompanyAccountsForUser(req, companyToken)
    if (accounts.length === 0) {
      return res.json({ success: true, data: { period: { start: startDate, end: endDate }, accounts: [], rows: [] } })
    }
    const tokens = accounts.map((a) => a.company_token)

    const params = [tokens, startDate, endDate]
    const rolesFilter =
      req.user.role === 'super-admin' ? '' : 'AND u.company_id = $4'
    if (rolesFilter) params.push(req.user.companyId)

    const q = await pool.query(
      `SELECT
         u.id            AS user_id,
         u.email,
         u.name,
         u.job_type,
         d.company_token,
         SUM(d.orders_count)::int                               AS orders_count,
         SUM(d.on_time_count)::int                              AS on_time_count,
         SUM(d.late_count)::int                                 AS late_count,
         CASE WHEN SUM(d.orders_count) > 0
              THEN ROUND((SUM(d.total_prep_minutes) / SUM(d.orders_count))::numeric, 2)
              ELSE 0 END                                        AS avg_prep_minutes
       FROM employee_kitchen_sla_daily d
       JOIN users u ON u.id = d.user_id
      WHERE d.company_token = ANY($1::text[])
        AND d.day_local BETWEEN $2 AND $3
        ${rolesFilter}
      GROUP BY u.id, u.email, u.name, u.job_type, d.company_token
      ORDER BY orders_count DESC, avg_prep_minutes ASC`,
      params
    )

    res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate },
        accounts: accounts.map((a) => ({ company_token: a.company_token, account_name: a.account_name })),
        rows: q.rows
      }
    })
  } catch (err) {
    console.error('❌ employee-sla leaderboard error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* -------------------------------------------------------------------------- */
/* per-user breakdown                                                         */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/employee-sla/users/:userId/daily
 * Daily kitchen-SLA history for a single user across the date range.
 */
router.get('/users/:userId/daily', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params
    const today = getTodayInTimezone(req.user.userTimezone)
    const startDate = parseDate(req.query.start_date, today)
    const endDate = parseDate(req.query.end_date, today)

    if (req.user.role === 'admin') {
      const u = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId])
      if (u.rowCount === 0) return res.status(404).json({ success: false, error: 'User not found' })
      if ((u.rows[0].company_id || null) !== req.user.companyId) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
      }
    }

    const q = await pool.query(
      `SELECT day_local, company_token, orders_count, on_time_count, late_count, avg_prep_minutes
         FROM employee_kitchen_sla_daily
        WHERE user_id = $1 AND day_local BETWEEN $2 AND $3
        ORDER BY day_local DESC, company_token`,
      [userId, startDate, endDate]
    )
    res.json({
      success: true,
      data: { period: { start: startDate, end: endDate }, rows: q.rows }
    })
  } catch (err) {
    console.error('❌ employee-sla user daily error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/* -------------------------------------------------------------------------- */
/* on-demand recompute (admin)                                                */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/employee-sla/recompute
 * Body: { company_token, date }  (date YYYY-MM-DD)
 * Forces an immediate recompute for one (account, date). Useful when an admin tags a
 * cook mid-day and wants the leaderboard to reflect the change without waiting for cron.
 */
router.post('/recompute', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { company_token, date } = req.body || {}
    if (!company_token || !date) {
      return res.status(400).json({ success: false, error: 'company_token and date are required' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' })
    }

    // Resolve account + timezone (and enforce company scope for admins)
    const r = await pool.query(
      `SELECT ca.company_id, ca.company_token, ca.api_token, c.timezone
         FROM company_accounts ca
         LEFT JOIN companies c ON c.id = ca.company_id
        WHERE ca.company_token = $1`,
      [company_token]
    )
    if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'Account not found' })
    const acc = r.rows[0]
    if (req.user.role === 'admin' && (acc.company_id || null) !== req.user.companyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    const result = await computeAndStoreEmployeeSlaForDay(
      acc.company_id,
      { company_token: acc.company_token, api_token: acc.api_token },
      date,
      acc.timezone || 'America/Lima'
    )
    res.json({ success: true, data: result })
  } catch (err) {
    console.error('❌ employee-sla recompute error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
