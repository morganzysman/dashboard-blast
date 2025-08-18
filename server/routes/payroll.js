import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'
import QRCode from 'qrcode'
import { config } from '../config/index.js'
import { notifyUserPaid, notifyAdminsClockEvent } from '../services/notificationService.js'

const router = Router()

// Helpers
function getBiweeklyPeriod(date = new Date(), timezone = 'America/Lima') {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
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

// Get company timezone by company_id
async function getCompanyTimezone(companyId) {
  const q = await pool.query(
    `SELECT timezone FROM companies WHERE id = $1`,
    [companyId]
  )
  return q.rows[0]?.timezone || 'America/Lima'
}

// Convert local time to UTC using company timezone
function convertLocalTimeToUTC(localDateStr, localTimeStr, timezone) {
  try {
    console.log(`🔄 Converting: ${localDateStr} ${localTimeStr} in ${timezone}`)
    
    // Validate inputs
    if (!localDateStr || !localTimeStr || !timezone) {
      throw new Error(`Missing required parameters: date=${localDateStr}, time=${localTimeStr}, timezone=${timezone}`)
    }
    
    // Parse and validate date components
    const [year, month, day] = localDateStr.split('-').map(Number)
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date: ${localDateStr}`)
    }
    
    // Parse and validate time components - handle HH:MM or HH:MM:SS format
    const timeParts = localTimeStr.split(':')
    if (timeParts.length < 2 || timeParts.length > 3) {
      throw new Error(`Invalid time format: ${localTimeStr}`)
    }
    
    const hour = parseInt(timeParts[0], 10)
    const minute = parseInt(timeParts[1], 10)
    const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      throw new Error(`Invalid time values: ${hour}:${minute}:${second}`)
    }
    
    // Create a proper date-time string
    const dateTimeString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
    
    // Use a simple approach: assume the time is in the target timezone and work backwards
    // This approach is more reliable than complex timezone calculations
    
    // Create a date in local system time with the given components
    const localSystemDate = new Date(year, month - 1, day, hour, minute, second)
    
    // Format this date as if it were in the target timezone to see what time it would be
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    // Test different UTC times until we find one that formats to our target local time
    const targetLocalTime = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
    
    // Start with an initial guess (could be off by timezone offset)
    let testUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    
    // Try to find the correct UTC time by iteration (max 24 attempts for safety)
    for (let attempt = 0; attempt < 24; attempt++) {
      const formattedTime = formatter.format(testUtc)
      
      if (formattedTime === targetLocalTime) {
        // Found the right UTC time!
        return testUtc.toISOString()
      }
      
      // Calculate how far off we are
      const actualLocalTime = new Date(formattedTime.replace(' ', 'T'))
      const expectedLocalTime = new Date(targetLocalTime.replace(' ', 'T'))
      const diffMs = expectedLocalTime.getTime() - actualLocalTime.getTime()
      
      // Adjust our UTC guess
      testUtc = new Date(testUtc.getTime() + diffMs)
      
      // If we're very close (within 1 minute), accept it
      if (Math.abs(diffMs) < 60000) {
        return testUtc.toISOString()
      }
    }
    
    // If we couldn't converge, use the last attempt
    const utcDate = testUtc
    
    const result = utcDate.toISOString()
    console.log(`✅ Converted ${dateTimeString} (${timezone}) → ${result} (UTC)`)
    
    return result
  } catch (error) {
    console.error('❌ Error converting local time to UTC:', error)
    console.error(`   Input: ${localDateStr} ${localTimeStr} ${timezone}`)
    
    // Fallback: create a basic UTC time (assuming the input was already close to UTC)
    try {
      const fallback = new Date(`${localDateStr}T${localTimeStr}:00Z`).toISOString()
      console.log(`🔧 Using fallback UTC time: ${fallback}`)
      return fallback
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError)
      // Last resort: current time
      return new Date().toISOString()
    }
  }
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
    // Employee scope check:
    // - If user has a companyId, require it to match the account's company
    // - Else if user has explicit userAccounts, require the token to be in that list
    // - Else, allow (QR secret will gate access)
    let belongs = true
    if (req.user.companyId) {
      belongs = !!(companyId2 && req.user.companyId === companyId2)
    } else if (Array.isArray(req.user.userAccounts) && req.user.userAccounts.length) {
      const tokens = req.user.userAccounts.map(a => a.company_token)
      belongs = tokens.includes(company_token)
    }
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
      // Notify admins
      try {
        await notifyAdminsClockEvent({
          companyId: companyId2,
          companyToken: company_token,
          userId,
          userName: req.user.userName,
          action: 'clock_out',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        })
      } catch {}
      return res.json({ success: true, data: { action: 'clock_out', entry: upd.rows[0] } })
    } else {
      // clock-in (store timestamptz server time; display handled by client)
      // Get company timezone for proper shift calculation
      const companyTimezone = await getCompanyTimezone(companyId2)
      
      // Resolve scheduled shift for today for this user/account
      // weekday in company timezone
      const nowTz = new Date(new Date().toLocaleString('en-US', { timeZone: companyTimezone }))
      const weekday = nowTz.getDay() // 0..6 (Sun..Sat)
      const qShift = await pool.query(
        `SELECT start_time, end_time FROM employee_shifts
         WHERE user_id = $1 AND company_token = $2 AND weekday = $3`,
        [userId, company_token, weekday]
      )
      let shiftStart = null
      let shiftEnd = null
      if (qShift.rowCount > 0) {
        // Get today's date in company timezone
        const yyyy = nowTz.getFullYear()
        const mm = String(nowTz.getMonth() + 1).padStart(2, '0')
        const dd = String(nowTz.getDate()).padStart(2, '0')
        const todayDate = `${yyyy}-${mm}-${dd}`
        
        // Get shift times - they are already in TIMESTAMPTZ format
        shiftStart = qShift.rows[0].start_time
        shiftEnd = qShift.rows[0].end_time
        
        console.log(`🕐 Using shift times for ${companyTimezone}:`, {
          shiftStart,
          shiftEnd
        })
      }
      const ins = await pool.query(
        'INSERT INTO time_entries(user_id, company_token, clock_in_at, shift_start, shift_end) VALUES ($1, $2, NOW(), $3, $4) RETURNING *',
        [userId, company_token, shiftStart, shiftEnd]
      )
      // If we have a shiftStart and the difference exceeds 10 minutes, include message
      let lateNotice = null
      if (shiftStart) {
        const clockInAt = new Date(ins.rows[0].clock_in_at)
        const scheduled = new Date(ins.rows[0].shift_start)
        const diffMinutes = Math.abs(clockInAt.getTime() - scheduled.getTime()) / 60000
        if (clockInAt > scheduled && diffMinutes > 10) {
          lateNotice = 'You are late'
        }
      }
      // Notify admins
      try {
        await notifyAdminsClockEvent({
          companyId: companyId2,
          companyToken: company_token,
          userId,
          userName: req.user.userName,
          action: 'clock_in',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        })
      } catch {}
      return res.json({ success: true, data: { action: 'clock_in', entry: ins.rows[0], lateNotice } })
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// List self time entries for current period (employee self-view)
router.get('/me/entries', requireAuth, async (req, res) => {
  try {
    // Get user's company timezone
    const userCompanyId = req.user.companyId
    const companyTimezone = userCompanyId ? await getCompanyTimezone(userCompanyId) : 'America/Lima'
    
    // Optional date range override (?start=YYYY-MM-DD&end=YYYY-MM-DD)
    const qsStart = (req.query.start || '').toString().slice(0, 10)
    const qsEnd = (req.query.end || '').toString().slice(0, 10)
    const isoRe = /^\d{4}-\d{2}-\d{2}$/
    let start
    let end
    if (isoRe.test(qsStart) && isoRe.test(qsEnd)) {
      // Use provided range
      start = qsStart
      end = qsEnd
      // Normalize if out of order
      if (new Date(start) > new Date(end)) {
        const tmp = start; start = end; end = tmp
      }
    } else {
      // Default to current biweekly period
      const p = getBiweeklyPeriod(new Date(), companyTimezone)
      start = p.start
      end = p.end
    }
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

// Employee: get own shifts for current week (or provided week_start date)
router.get('/me/shifts', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId
    
    // Get user's company timezone
    const userCompanyId = req.user.companyId
    const companyTimezone = userCompanyId ? await getCompanyTimezone(userCompanyId) : 'America/Lima'
    
    // Determine start of week (Sunday) in company timezone unless provided
    let startParam = (req.query.week_start || '').toString().slice(0, 10)
    let startTz
    if (startParam) {
      startTz = new Date(new Date(startParam).toLocaleString('en-US', { timeZone: companyTimezone }))
    } else {
      const nowTz = new Date(new Date().toLocaleString('en-US', { timeZone: companyTimezone }))
      startTz = new Date(nowTz)
      startTz.setDate(nowTz.getDate() - nowTz.getDay()) // Sunday
    }
    // Build days array for the week in timezone
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startTz)
      d.setDate(startTz.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      days.push({ date: `${yyyy}-${mm}-${dd}`, weekday: d.getDay() })
    }
    // Fetch shifts for user for any weekday
    const q = await pool.query(
      `SELECT es.weekday, es.company_token, es.start_time, es.end_time, ca.account_name
       FROM employee_shifts es
       LEFT JOIN company_accounts ca ON ca.company_token = es.company_token
       WHERE es.user_id = $1`,
      [userId]
    )
    const byWeekday = new Map()
    for (const r of q.rows) byWeekday.set(Number(r.weekday), r)
    const result = days.map(d => ({
      date: d.date,
      weekday: d.weekday,
      shift: byWeekday.has(d.weekday)
        ? {
            company_token: byWeekday.get(d.weekday).company_token,
            account_name: byWeekday.get(d.weekday).account_name || null,
            start_time: byWeekday.get(d.weekday).start_time,
            end_time: byWeekday.get(d.weekday).end_time
          }
        : null
    }))
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch shifts' })
  }
})

// Admin: list account entries by period and user
router.get('/admin/:companyToken/entries', requireAuth, async (req, res) => {
  try {
    const { companyToken } = req.params
    const { userId } = req.query
    const acct = await resolveAccount(companyToken)
    if (!acct) return res.status(404).json({ success: false, error: 'Account not found' })
    const companyId3 = acct.company_id
    
    // Get company timezone for proper period calculation
    const companyTimezone = await getCompanyTimezone(companyId3)
    const { start, end } = getBiweeklyPeriod(new Date(), companyTimezone)
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
    // Compute shift seconds per user based on entries' shift_start/shift_end within the period
    const shiftQ = await pool.query(
      `SELECT user_id,
              COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (shift_end - shift_start)))), 0) AS seconds
         FROM time_entries
        WHERE company_token = $1
          AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
          AND shift_start IS NOT NULL AND shift_end IS NOT NULL
        GROUP BY user_id`,
      [tokenForQuery, start, end]
    )
    // Compute accumulated delay (late seconds) per user: sum of (clock_in - shift_start) if positive
    const lateQ = await pool.query(
      `SELECT user_id,
              COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (clock_in_at - shift_start)))), 0) AS seconds
         FROM time_entries
        WHERE company_token = $1
          AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')
          AND shift_start IS NOT NULL
        GROUP BY user_id`,
      [tokenForQuery, start, end]
    )
    const shiftSeconds = {}
    for (const r of shiftQ.rows) {
      shiftSeconds[r.user_id] = Number(r.seconds) || 0
    }
    const lateSeconds = {}
    for (const r of lateQ.rows) {
      lateSeconds[r.user_id] = Number(r.seconds) || 0
    }
    res.json({ success: true, data: q.rows, period: { start, end }, shiftSeconds, lateSeconds })
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
         amount = COALESCE($3::numeric, amount),
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
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, COALESCE($5::numeric, 0))
       RETURNING *`,
      [user_id, company_token, clock_in_at, clock_out_at || null, computedAmount]
    )
    res.json({ success: true, data: ins.rows[0] })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Admin: delete a time entry (only if not paid)
router.delete('/admin/entries/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { id } = req.params
    
    // First check if the entry exists and is not paid
    const checkQuery = await pool.query(
      'SELECT id, user_id, company_token, paid FROM time_entries WHERE id = $1',
      [id]
    )
    
    if (checkQuery.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Entry not found' })
    }
    
    const entry = checkQuery.rows[0]
    
    if (entry.paid) {
      return res.status(400).json({ success: false, error: 'Cannot delete paid entries' })
    }
    
    // For admins (not super), ensure the account belongs to their company
    if (req.user.role === 'admin') {
      const cq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [entry.company_token])
      const companyId = cq.rows[0]?.company_id || null
      const belongs = !!(req.user.companyId && companyId && req.user.companyId === companyId)
      if (!belongs) return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    // Delete the entry
    const deleteQuery = await pool.query(
      'DELETE FROM time_entries WHERE id = $1 AND paid = FALSE RETURNING id',
      [id]
    )
    
    if (deleteQuery.rowCount === 0) {
      return res.status(400).json({ success: false, error: 'Entry not found or cannot be deleted' })
    }
    
    console.log(`✅ Admin ${req.user.email} deleted time entry ${id}`)
    
    res.json({ 
      success: true, 
      message: 'Entry deleted successfully',
      deletedId: id
    })
    
  } catch (e) {
    console.error('❌ Delete entry error:', e)
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
    
    // Get company timezone for proper period calculation
    const companyTimezone = await getCompanyTimezone(companyId4)
    const { start, end, label } = getBiweeklyPeriod(new Date(), companyTimezone)
    // Fetch company currency settings
    const comp = await pool.query(
      `SELECT c.id, c.currency, c.currency_symbol
         FROM company_accounts ca
         JOIN companies c ON c.id = ca.company_id
        WHERE ca.company_token = $1
        LIMIT 1`,
      [companyToken]
    )
    const currency = comp.rows[0]?.currency || 'USD'
    const currencySymbol = comp.rows[0]?.currency_symbol || '$'
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
    const payouts = new Map()
    for (const [userId, totalSeconds] of byUser.entries()) {
      // pick rate effective from first day of next period boundary logic handled at rate insertion time
      const rate = await client.query(
        `SELECT hourly_rate FROM employee_rates
         WHERE user_id = $1 AND company_token = $2 AND effective_from <= $3
         ORDER BY effective_from DESC LIMIT 1`, [userId, companyToken, end]
      )
      const hourly = rate.rows[0]?.hourly_rate || 0
      const amount = (totalSeconds / 3600) * Number(hourly)
      payouts.set(userId, (payouts.get(userId) || 0) + amount)
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
        [companyToken, userId, start, end, label, Math.round(totalSeconds), hourly, amount.toFixed(2), null]
      )
    }
    // mark all entries in period as paid
    await client.query(
      `UPDATE time_entries SET paid = TRUE, updated_at = NOW()
       WHERE company_token = $1 AND clock_in_at >= $2::date AND clock_in_at < ($3::date + INTERVAL '1 day')`,
      [companyToken, start, end]
    )
    await client.query('COMMIT')
    // After commit, send notifications to employees with positive payouts
    for (const [userId, totalAmount] of payouts.entries()) {
      if (totalAmount > 0) {
        try {
          await notifyUserPaid(userId, Number(totalAmount).toFixed(2), currencySymbol || currency, start, end)
        } catch {}
      }
    }
    res.json({ success: true })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ success: false, error: e.message })
  } finally {
    client.release()
  }
})

// Admin: notify employees paid for current period (without marking paid)
router.post('/admin/:companyToken/notify-paid', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') return res.status(403).json({ success: false, error: 'Access denied' })
    const { companyToken } = req.params
    const bq = await pool.query('SELECT company_id FROM company_accounts WHERE company_token = $1', [companyToken])
    const companyId4 = bq.rows[0]?.company_id || null
    if (!(req.user.companyId && companyId4 && req.user.companyId === companyId4)) return res.status(403).json({ success: false, error: 'Access denied' })
    
    // Get company timezone for proper period calculation
    const companyTimezone = await getCompanyTimezone(companyId4)
    const { start, end } = getBiweeklyPeriod(new Date(), companyTimezone)
    const comp = await pool.query(
      `SELECT c.id, c.currency, c.currency_symbol
         FROM company_accounts ca
         JOIN companies c ON c.id = ca.company_id
        WHERE ca.company_token = $1
        LIMIT 1`,
      [companyToken]
    )
    const currency = comp.rows[0]?.currency || 'USD'
    const currencySymbol = comp.rows[0]?.currency_symbol || '$'
    // compute totals per user for current period
    const entries = await pool.query(
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
      const rate = await pool.query(
        `SELECT hourly_rate FROM employee_rates
         WHERE user_id = $1 AND company_token = $2 AND effective_from <= $3
         ORDER BY effective_from DESC LIMIT 1`, [userId, companyToken, end]
      )
      const hourly = rate.rows[0]?.hourly_rate || 0
      const amount = (totalSeconds / 3600) * Number(hourly)
      if (amount > 0) {
        try { await notifyUserPaid(userId, Number(amount).toFixed(2), currencySymbol || currency, start, end) } catch {}
      }
    }
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

export default router

