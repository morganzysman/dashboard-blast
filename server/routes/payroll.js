import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'

const router = Router()
const TIMEZONE = 'America/Santiago'

// Helpers
function getBiweeklyPeriod(date = new Date()) {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }))
  const year = tzDate.getFullYear()
  const month = tzDate.getMonth()
  const day = tzDate.getDate()
  const startA = new Date(Date.UTC(year, month, 1))
  const endA = new Date(Date.UTC(year, month, 14))
  const startB = new Date(Date.UTC(year, month, 15))
  const endB = new Date(Date.UTC(year, month + 1, 0))
  let periodLabel = 'A'
  let start = startA
  let end = endA
  if (day >= 15) {
    periodLabel = 'B'
    start = startB
    end = endB
  }
  return {
    label: periodLabel,
    start: start.toISOString().substring(0, 10),
    end: end.toISOString().substring(0, 10)
  }
}

// QR secret for an account
router.get('/qr/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params
    const userAccounts = req.user.userAccounts || []
    if (!userAccounts.some(a => a.company_token === companyToken)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const q = await pool.query(
      'INSERT INTO account_qr_codes(company_token) VALUES ($1) ON CONFLICT (company_token) DO UPDATE SET company_token = EXCLUDED.company_token RETURNING company_token, qr_secret',
      [companyToken]
    )
    res.json({ success: true, data: q.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Clock in/out via QR (same endpoint). Requires auth; employees only act on self.
router.post('/clock', requireAuth, async (req, res) => {
  try {
    const { company_token, qr_secret } = req.body
    if (!company_token || !qr_secret) return res.status(400).json({ success: false, error: 'Missing params' })

    const userId = req.user.userId
    const userAccounts = req.user.userAccounts || []
    // Employee can only clock against accounts belonging to their company
    const belongs = userAccounts.some(a => a.company_token === company_token)
    if (!belongs) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const qr = await pool.query('SELECT qr_secret FROM account_qr_codes WHERE company_token = $1', [company_token])
    if (qr.rowCount === 0 || qr.rows[0].qr_secret !== qr_secret) {
      return res.status(403).json({ success: false, error: 'Invalid QR' })
    }

    // Check open entry
    const open = await pool.query(
      'SELECT id FROM time_entries WHERE user_id = $1 AND company_token = $2 AND clock_out_at IS NULL',
      [userId, company_token]
    )
    if (open.rowCount > 0) {
      // clock-out
      const id = open.rows[0].id
      const upd = await pool.query(
        'UPDATE time_entries SET clock_out_at = NOW() AT TIME ZONE $1, updated_at = NOW() WHERE id = $2 AND locked = FALSE RETURNING *',
        [TIMEZONE, id]
      )
      return res.json({ success: true, data: { action: 'clock_out', entry: upd.rows[0] } })
    } else {
      // clock-in
      const ins = await pool.query(
        'INSERT INTO time_entries(user_id, company_token, clock_in_at) VALUES ($1, $2, NOW() AT TIME ZONE $3) RETURNING *',
        [userId, company_token, TIMEZONE]
      )
      return res.json({ success: true, data: { action: 'clock_in', entry: ins.rows[0] } })
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// List self time entries for current period (employee self-view)
router.get('/me/entries', requireAuth, async (req, res) => {
  try {
    const { start, end } = getBiweeklyPeriod()
    const q = await pool.query(
      `SELECT * FROM time_entries
       WHERE user_id = $1 AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
       ORDER BY clock_in_at DESC`,
      [req.user.userId, start, end]
    )
    res.json({ success: true, data: q.rows, period: { start, end } })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: list account entries by period and user
router.get('/admin/:companyToken/entries', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params
    const { userId } = req.query
    const { start, end } = getBiweeklyPeriod()
    const userAccounts = req.user.userAccounts || []
    if (!userAccounts.some(a => a.company_token === companyToken) || (req.user.role !== 'admin' && req.user.role !== 'super-admin')) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const params = [companyToken, start, end]
    let whereUser = ''
    if (userId) { params.push(userId); whereUser = ' AND user_id = $4' }
    const q = await pool.query(
      `SELECT * FROM time_entries
       WHERE company_token = $1
         AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
         ${whereUser}
       ORDER BY user_id, clock_in_at`, params)
    res.json({ success: true, data: q.rows, period: { start, end } })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: edit a time entry (only if not locked)
router.put('/admin/entries/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const { id } = req.params
    const { clock_in_at, clock_out_at } = req.body
    const upd = await pool.query(
      `UPDATE time_entries SET
         clock_in_at = COALESCE($1, clock_in_at),
         clock_out_at = COALESCE($2, clock_out_at),
         updated_at = NOW()
       WHERE id = $3 AND locked = FALSE
       RETURNING *`, [clock_in_at, clock_out_at, id]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Entry not found or locked' })
    res.json({ success: true, data: upd.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: mark payroll paid and lock entries
router.post('/admin/:companyToken/pay', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const { companyToken } = req.params
    const { start, end } = getBiweeklyPeriod()
    await client.query('BEGIN')
    // compute totals per user
    const entries = await client.query(
      `SELECT user_id, clock_in_at, clock_out_at
       FROM time_entries
       WHERE company_token = $1 AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
         AND clock_out_at IS NOT NULL AND locked = FALSE`, [companyToken, start, end]
    )
    const byUser = new Map()
    for (const r of entries.rows) {
      const secs = Math.max(0, (new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime()) / 1000)
      byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + secs)
    }
    for (const [userId, totalSeconds] of byUser.entries()) {
      // pick rate effective from first day of next period boundary logic handled at rate insertion time
      const rate = await client.query(
        `SELECT hourly_rate FROM employee_rates
         WHERE user_id = $1 AND company_token = $2 AND effective_from <= $3
         ORDER BY effective_from DESC LIMIT 1`, [userId, companyToken, end]
      )
      const hourly = rate.rows[0]?.hourly_rate || 0
      const amount = (totalSeconds / 3600) * Number(hourly)
      await client.query(
        `INSERT INTO payroll_snapshots(company_token, user_id, period_start, period_end, period_label, total_seconds, applied_hourly_rate, total_amount, paid, paid_at, snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW(),$9)
         ON CONFLICT (company_token, user_id, period_start, period_end) DO UPDATE SET
           total_seconds = EXCLUDED.total_seconds,
           applied_hourly_rate = EXCLUDED.applied_hourly_rate,
           total_amount = EXCLUDED.total_amount,
           paid = TRUE,
           paid_at = NOW(),
           snapshot = EXCLUDED.snapshot`,
        [companyToken, userId, start, end, getBiweeklyPeriod().label, Math.round(totalSeconds), hourly, amount.toFixed(2), null]
      )
    }
    // lock all entries in period
    await client.query(
      `UPDATE time_entries SET locked = TRUE, updated_at = NOW()
       WHERE company_token = $1 AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')`,
      [companyToken, start, end]
    )
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ success: false, error: e.message })
  } finally {
    client.release()
  }
})

export default router

