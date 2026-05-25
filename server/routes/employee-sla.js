import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { pool } from '../database.js'
import { computeAndStoreEmployeeSlaForDay } from '../services/employeeSlaService.js'
import { weightedMedian } from '../services/olaClickService.js'

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

    // We read straight from the per-order table here (instead of the daily
    // rollup) so we can compute avg_cook_count — the average team size when
    // this cook was on shift. cook_count = 1 means a solo shift; >1 means a
    // shared shift where wins/losses were spread across multiple cooks.
    //
    // Median per cook is computed directly via PERCENTILE_CONT (exact across
    // the full range, since we're aggregating over raw per-order rows here —
    // no daily-median approximation needed). avg_prep_minutes is retained as
    // the secondary signal.
    const q = await pool.query(
      `SELECT
         u.id            AS user_id,
         u.email,
         u.name,
         u.job_type,
         o.company_token,
         COUNT(*)::int                                          AS orders_count,
         COUNT(*) FILTER (WHERE o.on_time)::int                 AS on_time_count,
         COUNT(*) FILTER (WHERE NOT o.on_time)::int             AS late_count,
         ROUND(AVG(o.prep_minutes)::numeric, 2)                 AS avg_prep_minutes,
         ROUND(
           (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.prep_minutes))::numeric,
           2
         )                                                      AS median_prep_minutes,
         ROUND(AVG(o.cook_count)::numeric, 2)                   AS avg_cook_count
       FROM employee_kitchen_sla_orders o
       JOIN users u ON u.id = o.user_id
      WHERE o.company_token = ANY($1::text[])
        AND o.day_local BETWEEN $2 AND $3
        ${rolesFilter}
      GROUP BY u.id, u.email, u.name, u.job_type, o.company_token
      ORDER BY orders_count DESC, median_prep_minutes ASC`,
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
/* account x channel matrix (main SLA view)                                   */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/employee-sla/account-matrix
 * Query: start_date, end_date (YYYY-MM-DD; default = today/today)
 *
 * Returns the per-account-per-channel SLA scoreboard used by the main SLA
 * dashboard:
 *   { period, accounts: [{ company_token, account_name, channels: { [channelKey]: stats }, total: stats }],
 *     channels: [orderedChannelKey...], grandTotal: stats }
 *
 * Stats: { ordersCount, onTimeCount, lateCount, onTimeRate, avgPrepMinutes,
 *           medianPrepMinutes, targetMinutes }
 *
 * The channel column order pins the four SLA-editor keys first
 * (DELIVERY:RAPPI_TURBO, DELIVERY:RAPPI, ONSITE:*, DELIVERY:OTHER) so the
 * matrix has a stable, predictable shape, then appends any additional
 * channels that had traffic in the window. ONSITE:* aggregates every ONSITE:x
 * sub-channel since they share the same target.
 *
 * Central-tendency math
 * ---------------------
 * `avgPrepMinutes` is a weighted mean across days (weighted by `orders_count`),
 * which is the exact population mean over the multi-day window.
 *
 * `medianPrepMinutes` is the *weighted median of the per-day medians*,
 * weighted by `orders_count`. This is an APPROXIMATION of the true population
 * median across the window — we don't store raw samples, only the per-day
 * median + count. It is exact when there is only one day in the window
 * (single value) and tracks the true population median closely as long as
 * per-day order counts are roughly stable. We could persist a full sketch
 * (e.g. t-digest) to make this exact, but for the SLA workload (single
 * location, tens to hundreds of orders per day) the approximation is well
 * within the noise floor and the storage cost would dwarf the precision
 * gain.
 *
 * The primary displayed metric in the UI is `medianPrepMinutes`; `avgPrepMinutes`
 * is kept around as a secondary tooltip value and outlier-detection signal.
 */
router.get('/account-matrix', requireAuth, async (req, res) => {
  try {
    const today = getTodayInTimezone(req.user.userTimezone)
    const startDate = parseDate(req.query.start_date, today)
    const endDate = parseDate(req.query.end_date, today)

    const accounts = await getCompanyAccountsForUser(req, null)
    if (accounts.length === 0) {
      return res.json({
        success: true,
        data: { period: { start: startDate, end: endDate }, accounts: [], channels: [], grandTotal: emptyStats() }
      })
    }
    const tokens = accounts.map((a) => a.company_token)

    // Per-day rows (no SUM/GROUP BY in SQL) so we can compute the weighted
    // median of daily medians in JS. Sums for the other metrics are also
    // computed in JS — trivially cheap given the row volume (per-account
    // per-day per-channel for a single window).
    const q = await pool.query(
      `SELECT
         company_token,
         channel_key,
         day_local,
         orders_count,
         on_time_count,
         late_count,
         total_prep_minutes,
         unreliable_prep_count,
         target_minutes,
         median_prep_minutes
       FROM account_kitchen_sla_daily
       WHERE company_token = ANY($1::text[])
         AND day_local BETWEEN $2 AND $3`,
      [tokens, startDate, endDate]
    )

    // Bucket sub-channels back into their canonical column. Targets are
    // resolved per sub-channel anyway; for the matrix view we collapse the
    // long tail into the four editor keys + a single "OTHER" bucket so the
    // table stays scannable.
    const PINNED = ['DELIVERY:RAPPI_TURBO', 'DELIVERY:RAPPI', 'ONSITE:*', 'DELIVERY:OTHER']
    /** @param {string} ck */
    function bucket(ck) {
      const k = String(ck || '').toUpperCase()
      if (k === 'DELIVERY:RAPPI_TURBO' || k === 'DELIVERY:RAPPI') return k
      if (k.startsWith('ONSITE:')) return 'ONSITE:*'
      if (k.startsWith('DELIVERY:')) return 'DELIVERY:OTHER'
      return 'OTHER:*'
    }

    /** @type {Map<string, Map<string, ReturnType<typeof emptyStats>>>} */
    const perAccount = new Map()
    /** @type {Set<string>} */
    const seenChannels = new Set(PINNED)
    /** @type {Record<string, ReturnType<typeof emptyStats>>} */
    const grand = {}

    for (const row of q.rows) {
      const colKey = bucket(row.channel_key)
      seenChannels.add(colKey)
      if (!perAccount.has(row.company_token)) perAccount.set(row.company_token, new Map())
      const accMap = perAccount.get(row.company_token)
      const cell = accMap.get(colKey) || emptyStats(row.target_minutes)
      const ordersCount = Number(row.orders_count) || 0
      cell.ordersCount += ordersCount
      cell.onTimeCount += Number(row.on_time_count) || 0
      cell.lateCount += Number(row.late_count) || 0
      cell.totalPrepMinutes += Number(row.total_prep_minutes) || 0
      cell.unreliablePrepCount += Number(row.unreliable_prep_count) || 0
      // Per-day median ↦ (value, weight=orders_count). Skip rows with no
      // reliable orders (median is NULL there) so they don't pollute the
      // weighted-median sort.
      if (row.median_prep_minutes != null && ordersCount > 0) {
        cell.medianSamples.push([Number(row.median_prep_minutes), ordersCount])
      }
      // target_minutes per editor key is single-valued, but if multiple
      // sub-channels collapsed into "OTHER" carry different targets we keep
      // the highest (most lenient) so a bucketed pseudo-cell isn't unfairly
      // penalised.
      cell.targetMinutes = Math.max(cell.targetMinutes || 0, Number(row.target_minutes) || 0)
      accMap.set(colKey, cell)

      const g = grand[colKey] || emptyStats()
      g.ordersCount += ordersCount
      g.onTimeCount += Number(row.on_time_count) || 0
      g.lateCount += Number(row.late_count) || 0
      g.totalPrepMinutes += Number(row.total_prep_minutes) || 0
      g.unreliablePrepCount += Number(row.unreliable_prep_count) || 0
      if (row.median_prep_minutes != null && ordersCount > 0) {
        g.medianSamples.push([Number(row.median_prep_minutes), ordersCount])
      }
      g.targetMinutes = Math.max(g.targetMinutes || 0, Number(row.target_minutes) || 0)
      grand[colKey] = g
    }

    const channels = [
      ...PINNED.filter((c) => seenChannels.has(c)),
      ...[...seenChannels].filter((c) => !PINNED.includes(c)).sort()
    ]

    const accountRows = accounts.map((a) => {
      const accMap = perAccount.get(a.company_token) || new Map()
      const channelsOut = {}
      const total = emptyStats()
      for (const c of channels) {
        const cell = accMap.get(c) || emptyStats()
        channelsOut[c] = finaliseStats(cell)
        total.ordersCount += cell.ordersCount
        total.onTimeCount += cell.onTimeCount
        total.lateCount += cell.lateCount
        total.totalPrepMinutes += cell.totalPrepMinutes
        total.unreliablePrepCount += cell.unreliablePrepCount
        // Per-account total median: re-use the same (value, weight) samples
        // we collected for the cells; concatenation is fine because
        // weightedMedian is order-invariant within the input sort.
        for (const s of cell.medianSamples) total.medianSamples.push(s)
      }
      return {
        company_token: a.company_token,
        account_name: a.account_name,
        channels: channelsOut,
        total: finaliseStats(total)
      }
    })

    const grandTotal = emptyStats()
    const grandPerChannel = {}
    for (const c of channels) {
      const cell = grand[c] || emptyStats()
      grandPerChannel[c] = finaliseStats(cell)
      grandTotal.ordersCount += cell.ordersCount
      grandTotal.onTimeCount += cell.onTimeCount
      grandTotal.lateCount += cell.lateCount
      grandTotal.totalPrepMinutes += cell.totalPrepMinutes
      grandTotal.unreliablePrepCount += cell.unreliablePrepCount
      for (const s of cell.medianSamples) grandTotal.medianSamples.push(s)
    }

    res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate },
        channels,
        accounts: accountRows,
        grandPerChannel,
        grandTotal: finaliseStats(grandTotal)
      }
    })
  } catch (err) {
    console.error('❌ employee-sla account-matrix error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

function emptyStats(target = 0) {
  return {
    ordersCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    totalPrepMinutes: 0,
    unreliablePrepCount: 0,
    targetMinutes: Number(target) || 0,
    /** (per-day median, weight=orders_count) tuples; consumed by weightedMedian. */
    medianSamples: []
  }
}

function finaliseStats(cell) {
  const orders = cell.ordersCount || 0
  const unreliable = cell.unreliablePrepCount || 0
  // SLA coverage = orders that survived `isPrepStampLikelyMissing` / orders
  // the SLA pipeline tried to evaluate. Denominator includes the unreliable
  // ones because *those are the orders we attempted to score and dropped*;
  // unprepped orders (no close stamp etc.) are not part of the denominator.
  const evaluated = orders + unreliable
  const med = weightedMedian(cell.medianSamples)
  return {
    ordersCount: orders,
    onTimeCount: cell.onTimeCount || 0,
    lateCount: cell.lateCount || 0,
    onTimeRate: orders > 0 ? cell.onTimeCount / orders : null,
    avgPrepMinutes: orders > 0 ? Number((cell.totalPrepMinutes / orders).toFixed(2)) : null,
    // Primary central-tendency metric. Weighted-median-of-daily-medians; see
    // JSDoc on /account-matrix for the approximation notes.
    medianPrepMinutes: med != null ? Number(med.toFixed(2)) : null,
    targetMinutes: cell.targetMinutes || null,
    unreliablePrepCount: unreliable,
    coverageEvaluated: evaluated,
    coveragePct: evaluated > 0 ? orders / evaluated : null
  }
}

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
      `SELECT day_local, company_token, orders_count, on_time_count, late_count,
              avg_prep_minutes, median_prep_minutes
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
