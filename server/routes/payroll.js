import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'
import QRCode from 'qrcode'
import { config } from '../config/index.js'

const router = Router()
const TIMEZONE = 'America/Santiago'

// Helpers
function getBiweeklyPeriod(date = new Date()) {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }))
  const year = tzDate.getFullYear()
  const month = tzDate.getMonth()
  const day = tzDate.getDate()
  const startA = new Date(Date.UTC(year, month, 1))
  const endA = new Date(Date.UTC(year, month, 15))
  const startB = new Date(Date.UTC(year, month, 16))
  const endB = new Date(Date.UTC(year, month + 1, 0))
  let periodLabel = 'A'
  let start = startA
  let end = endA
  if (day >= 16) {
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

// Resolve account by token or display name
async function resolveAccount(companyToken) {
  const q = await pool.query(
    `SELECT company_id, company_token, account_name
     FROM company_accounts
     WHERE company_token = $1
        OR account_name = $1
        OR account_name ILIKE $2
        OR REPLACE(account_name, ' ', '-') = $1
        OR REPLACE(account_name, '-', ' ') = $1
     LIMIT 1`,
    [companyToken, companyToken]
  )
  return q.rows[0] || null
}

// QR secret for an account
router.get('/qr/:companyToken', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params
    const acct = await resolveAccount(companyToken)
    if (!acct) return res.status(404).json({ success: false, error: 'Account not found' })
    const companyId = acct.company_id
    const allowedRole = req.user.role === 'admin' || req.user.role === 'super-admin'
    const belongs = !!(req.user.companyId && companyId && req.user.companyId === companyId)
    if (!allowedRole || (req.user.role === 'admin' && !belongs)) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const qrUpsert = await pool.query(
      'INSERT INTO account_qr_codes(company_token) VALUES ($1) ON CONFLICT (company_token) DO UPDATE SET company_token = EXCLUDED.company_token RETURNING company_token, qr_secret',
      [acct.company_token]
    )
    res.json({ success: true, data: qrUpsert.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// QR PNG image for an account (admin or super-admin)
router.get('/qr/:companyToken/image', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params
    const acct = await resolveAccount(companyToken)
    if (!acct) return res.status(404).json({ success: false, error: 'Account not found' })
    const isAdminOrSuper = req.user.role === 'admin' || req.user.role === 'super-admin'
    const belongs = !!(req.user.companyId && acct?.company_id && req.user.companyId === acct.company_id)
    if (!isAdminOrSuper || (req.user.role === 'admin' && !belongs)) return res.status(403).json({ success: false, error: 'Access denied' })

    let qr = await pool.query('SELECT qr_secret FROM account_qr_codes WHERE company_token = $1', [acct.company_token])
    let secret = qr.rows[0]?.qr_secret
    if (!secret) {
      // Create it on-demand if missing
      const up = await pool.query(
        'INSERT INTO account_qr_codes(company_token) VALUES ($1) ON CONFLICT (company_token) DO UPDATE SET updated_at = NOW() RETURNING qr_secret',
        [acct.company_token]
      )
      secret = up.rows[0]?.qr_secret || null
      if (!secret) return res.status(500).json({ success: false, error: 'Failed to create QR' })
    }

    const path = `/clock?company_token=${encodeURIComponent(acct.company_token)}&qr_secret=${encodeURIComponent(secret)}`
    const fullUrl = config.appBaseUrl
      ? `${config.appBaseUrl.replace(/\/$/, '')}${path}`
      : path
    const png = await QRCode.toBuffer(fullUrl, { type: 'png', width: 512, margin: 2 })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', `attachment; filename="qr-${acct.company_token}.png"`)
    return res.send(png)
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
    const cq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [company_token])
    const companyId2 = cq.rows[0]?.company_id || null
    // Employee can only clock against accounts belonging to their company
    const belongs = !!(req.user.companyId && companyId2 && req.user.companyId === companyId2)
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
      // Compute amount atomically in SQL to avoid timezone drift
      const upd = await pool.query(
        `UPDATE time_entries te
         SET clock_out_at = NOW(),
             amount = ROUND((
               CEIL(EXTRACT(EPOCH FROM (NOW() - te.clock_in_at)) / 60)::numeric / 60
             ) * COALESCE((SELECT hourly_rate FROM users u WHERE u.id = te.user_id), 0), 2),
             updated_at = NOW()
         WHERE te.id = $1 AND paid = FALSE
         RETURNING *`,
        [id]
      )
      return res.json({ success: true, data: { action: 'clock_out', entry: upd.rows[0] } })
    } else {
      // clock-in (store timestamptz server time; display handled by client)
      const ins = await pool.query(
        'INSERT INTO time_entries(user_id, company_token, clock_in_at) VALUES ($1, $2, NOW()) RETURNING *',
        [userId, company_token]
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

// Get latest open entry for a given day (defaults to today)
router.get('/me/open-entry', requireAuth, async (req, res) => {
  try {
    const date = (req.query.date || new Date().toISOString().substring(0,10)).slice(0,10)
    const companyToken = req.query.company_token || null
    const params = [req.user.userId, date, date]
    let whereCompany = ''
    if (companyToken) { params.push(companyToken); whereCompany = ' AND company_token = $4' }
    const q = await pool.query(
      `SELECT * FROM time_entries
       WHERE user_id = $1
         AND clock_out_at IS NULL
         AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
         ${whereCompany}
       ORDER BY clock_in_at DESC
       LIMIT 1`, params
    )
    res.json({ success: true, data: q.rows[0] || null, date })
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
    const acct = await resolveAccount(companyToken)
    if (!acct) return res.status(404).json({ success: false, error: 'Account not found' })
    const companyId3 = acct.company_id
    const isAdminOrSuper = req.user.role === 'admin' || req.user.role === 'super-admin'
    if (!isAdminOrSuper) return res.status(403).json({ success: false, error: 'Access denied' })
    const belongs = !!(req.user.companyId && companyId3 && req.user.companyId === companyId3)
    if (req.user.role === 'admin' && !belongs) return res.status(403).json({ success: false, error: 'Access denied' })
    const tokenForQuery = acct.company_token
    const params = [tokenForQuery, start, end]
    let whereUser = ''
    if (userId) { params.push(userId); whereUser = ' AND user_id = $4' }
    const q = await pool.query(
       `SELECT te.*
       FROM time_entries te
       WHERE company_token = $1
         AND te.clock_in_at >= $2::date AND te.clock_in_at < ($3::date + INTERVAL '1 day')
         ${whereUser}
       ORDER BY te.user_id, te.clock_in_at`, params)
    res.json({ success: true, data: q.rows, period: { start, end } })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: edit a time entry (only if not paid)
router.put('/admin/entries/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const { id } = req.params
    const { clock_in_at, clock_out_at, amount } = req.body
    const upd = await pool.query(
      `UPDATE time_entries SET
         clock_in_at = COALESCE($1, clock_in_at),
         clock_out_at = COALESCE($2, clock_out_at),
         amount = COALESCE($3, amount),
         updated_at = NOW()
       WHERE id = $4 AND paid = FALSE
       RETURNING *`, [clock_in_at, clock_out_at, amount, id]
    )
    if (upd.rowCount === 0) return res.status(404).json({ success: false, error: 'Entry not found or locked' })
    res.json({ success: true, data: upd.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: create a time entry manually
router.post('/admin/entries', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    const { user_id, company_token, clock_in_at, clock_out_at, amount } = req.body || {}
    if (!user_id || !company_token || !clock_in_at) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    // For admins (not super), ensure the account belongs to their company
    if (req.user.role === 'admin') {
      const cq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [company_token])
      const companyId = cq.rows[0]?.company_id || null
      const belongs = !!(req.user.companyId && companyId && req.user.companyId === companyId)
      if (!belongs) return res.status(403).json({ success: false, error: 'Access denied' })
    }

    // If creating an open entry, ensure there is no other open entry for the same user/account
    if (!clock_out_at) {
      const open = await pool.query(
        'SELECT 1 FROM time_entries WHERE user_id = $1 AND company_token = $2 AND clock_out_at IS NULL',
        [user_id, company_token]
      )
      if (open.rowCount > 0) {
        return res.status(400).json({ success: false, error: 'User already has an open entry for this account' })
      }
    }

    // Compute amount if not provided and both timestamps present
    let computedAmount = amount
    if ((amount == null || Number.isNaN(Number(amount))) && clock_out_at) {
      const q = await pool.query(
        `SELECT ROUND((
           CEIL(EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz)) / 60)::numeric / 60
         ) * COALESCE((SELECT hourly_rate FROM users u WHERE u.id = $3), 0), 2) AS amt`,
        [clock_in_at, clock_out_at, user_id]
      )
      computedAmount = q.rows[0]?.amt ?? 0
    }

    const ins = await pool.query(
      `INSERT INTO time_entries(user_id, company_token, clock_in_at, clock_out_at, amount)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, COALESCE($5, 0))
       RETURNING *`,
      [user_id, company_token, clock_in_at, clock_out_at || null, computedAmount]
    )
    res.json({ success: true, data: ins.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: mark payroll paid for the period
router.post('/admin/:companyToken/pay', requireAuth, async (req, res) => {
  const client = await pool.connect()
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const { companyToken } = req.params
    const bq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [companyToken])
    const companyId4 = bq.rows[0]?.company_id || null
    if (!(req.user.companyId && companyId4 && req.user.companyId === companyId4)) return res.status(403).json({ success: false, error: 'Access denied' })
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
    // mark all entries in period as paid
    await client.query(
      `UPDATE time_entries SET paid = TRUE, updated_at = NOW()
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

