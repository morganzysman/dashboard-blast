import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { pool } from '../database.js'
import { getTimezoneAwareDate } from '../services/olaClickService.js'
import { getPaymentData, getTipsData } from '../services/ledgerReadService.js'
import { computeAndStoreDailyGain, backfillGains } from '../services/dailyGainService.js'
import { syncComboFactsForDay, backfillComboStats } from '../services/comboStatsService.js'
import { getBadges, evaluateCompanyMonths } from '../services/achievementService.js'
import { fetchStoreStatus } from '../services/publicOlaClickService.js'

// Food apps Blast actually sells on. Narrowing the live lookup keeps
// GET /v1/stores/status fast (each provider is checked in real time).
const STORE_STATUS_PROVIDERS = ['RAPPI', 'RAPPI_TURBO', 'PEDIDOSYA']

// Live provider checks are slow and rate-limited; reuse a fresh result for
// a short window so dashboard refresh / date-picker churn doesn't fan out
// another N OlaClick calls per company.
const STORE_STATUS_TTL_MS = 45_000
const storeStatusCache = new Map() // companyId → { data, expiresAt }

const router = Router()

// GET /api/analytics/profitability
// Aggregates profitability metrics across user's accounts for a given date range
router.get('/profitability', requireAuth, async (req, res) => {
  try {
    // Normalize filter params like other routes (support nested objects and flat keys)
    let currentParams = {}
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const paramName = key.slice(7, -1)
        currentParams[`filter[${paramName}]`] = req.query[key]
      } else {
        currentParams[key] = req.query[key]
      }
    })
    // Also merge nested filter object if present (e.g., ?filter[start_date]=... parsed as req.query.filter.start_date)
    if (req.query.filter && typeof req.query.filter === 'object') {
      for (const [k, v] of Object.entries(req.query.filter)) {
        currentParams[`filter[${k}]`] = v
      }
    }

    // Fetch company timezone (accept filter[timezone], filter.timezone, or timezone)
    let timezone = currentParams['filter[timezone]'] || req.query?.filter?.timezone || req.query.timezone
    if (!timezone) {
      const tzQ = await pool.query('SELECT timezone FROM companies WHERE id = $1', [req.user.companyId])
      timezone = tzQ.rows[0]?.timezone || 'America/Lima'
    }
    // Accept filter[start_date]/filter[end_date], nested filter object, and flat keys
    let startDate = currentParams['filter[start_date]'] || req.query?.filter?.start_date || req.query.start_date
    let endDate = currentParams['filter[end_date]'] || req.query?.filter?.end_date || req.query.end_date

    // If either missing, default to today in company timezone
    if (!startDate || !endDate) {
      const today = getTimezoneAwareDate(null, timezone)
      startDate = today
      endDate = today
    }
    // Normalize provided dates to YYYY-MM-DD without shifting timezone
    // Only coerce format; do not replace values with "today"
    startDate = getTimezoneAwareDate(startDate, timezone)
    endDate = getTimezoneAwareDate(endDate, timezone)

    // Debug logging for parsed period (safe, concise)
    console.log('📊 Profitability period parsed:', { startDate, endDate, timezone, rawQuery: req.query })

    // Calculate days in period
    const startObj = new Date(startDate)
    const endObj = new Date(endDate)
    const daysDiff = Math.max(1, Math.ceil((endObj.getTime() - startObj.getTime()) / (1000 * 3600 * 24)) + 1)
    const todayStr = getTimezoneAwareDate(null, timezone)
    const isEndToday = endDate === todayStr

    // Fetch accounts by user's company
    let userAccounts = []
    if (req.user.companyId) {
      const q = await pool.query('SELECT company_token, api_token, public_api_key FROM company_accounts WHERE company_id = $1', [req.user.companyId])
      userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token, public_api_key: r.public_api_key }))
    }
    if (userAccounts.length === 0) {
      return res.json({ success: true, data: { period: { start: startDate, end: endDate, days: daysDiff }, company: { grossSales: 0, paymentFees: 0, netAfterFees: 0, foodCosts: 0, utilityCosts: 0, operatingProfit: 0, operatingMargin: 0, feeRate: 0, tips: 0, tipRate: 0 }, accounts: [], distributions: { feesByMethod: {}, netRevenueByMethod: {} } } })
    }

    // Fetch payments and tips for all accounts in parallel
    const filterParams = {
      'filter[start_date]': startDate,
      'filter[end_date]': endDate,
      'filter[timezone]': timezone
    }

    const paymentsPromises = userAccounts.map(acc => getPaymentData(acc, filterParams))
    const tipsPromises = userAccounts.map(acc => getTipsData(acc, filterParams))
    const [paymentsResults, tipsResults] = await Promise.all([
      Promise.all(paymentsPromises),
      Promise.all(tipsPromises)
    ])

    // Fetch costs for all accounts in one go
    const accountTokens = userAccounts.map(a => a.company_token)
    const accPlaceholders = accountTokens.map((_, i) => `$${i + 2}`).join(', ')

    const utilityQuery = `
      SELECT company_token, total_daily
      FROM utility_costs
      WHERE company_id = $1 AND company_token IN (${accPlaceholders})
    `
    const paymentCostsQuery = `
      SELECT company_token, payment_method_code, cost_percentage, fixed_cost
      FROM payment_method_costs
      WHERE company_id = $1 AND company_token IN (${accPlaceholders})
    `

    // Payroll costs (sum of closed entry amounts) per account within period
    // For payroll we pass [startDate, endDate, ...accountTokens], so placeholders start at $3
    const payrollAccPlaceholders = accountTokens.map((_, i) => `$${i + 3}`).join(', ')
    const payrollQuery = `
      SELECT te.company_token,
             COALESCE(SUM(
               COALESCE(
                 te.amount,
                 (EXTRACT(EPOCH FROM (te.clock_out_at - te.clock_in_at)) / 3600.0) * COALESCE(u.hourly_rate, 0)
               )
             ), 0) AS payroll_sum,
             COUNT(*) AS entries_count
      FROM time_entries te
      LEFT JOIN users u ON u.id = te.user_id
      WHERE te.clock_in_at >= $1::date
        AND te.clock_in_at < ($2::date + INTERVAL '1 day')
        AND te.clock_out_at IS NOT NULL
        AND te.company_token IN (${payrollAccPlaceholders})
      GROUP BY te.company_token
    `

    const [utilityRes, paymentCostsRes, payrollRes] = await Promise.all([
      pool.query(utilityQuery, [req.user.companyId, ...accountTokens]),
      pool.query(paymentCostsQuery, [req.user.companyId, ...accountTokens]),
      pool.query(payrollQuery, [startDate, endDate, ...accountTokens])
    ])

    // Projected payroll for open entries on current day (if the selected end date is today)
    let projectedPayrollRes = { rows: [] }
    if (isEndToday && accountTokens.length > 0) {
      const projectedAccPlaceholders = accountTokens.map((_, i) => `$${i + 2}`).join(', ')
      const projectedPayrollQuery = `
        SELECT te.company_token,
               COALESCE(SUM(EXTRACT(EPOCH FROM (NOW() - te.clock_in_at)) / 3600.0 * COALESCE(u.hourly_rate, 0)), 0) AS projected_payroll_sum,
               COUNT(*) AS open_entries_count
        FROM time_entries te
        JOIN users u ON u.id = te.user_id
        WHERE te.clock_out_at IS NULL
          AND te.company_token IN (${projectedAccPlaceholders})
          AND te.clock_in_at::date = $1::date
        GROUP BY te.company_token
      `
      projectedPayrollRes = await pool.query(projectedPayrollQuery, [endDate, ...accountTokens])
    }

    const accountKeyToUtility = new Map()
    utilityRes.rows.forEach(row => {
      accountKeyToUtility.set(row.company_token, row)
    })

    const accountKeyToPaymentCosts = new Map()
    paymentCostsRes.rows.forEach(row => {
      const key = row.company_token
      if (!accountKeyToPaymentCosts.has(key)) accountKeyToPaymentCosts.set(key, new Map())
      accountKeyToPaymentCosts.get(key).set((row.payment_method_code || '').toLowerCase(), row)
    })

    const accountKeyToPayroll = new Map()
    payrollRes.rows.forEach(row => {
      accountKeyToPayroll.set(row.company_token, {
        payroll_sum: Number(row.payroll_sum) || 0,
        entries_count: Number(row.entries_count) || 0
      })
    })

    const accountKeyToProjectedPayroll = new Map()
    projectedPayrollRes.rows.forEach(row => {
      accountKeyToProjectedPayroll.set(row.company_token, {
        projected_payroll_sum: Number(row.projected_payroll_sum) || 0,
        open_entries_count: Number(row.open_entries_count) || 0
      })
    })

    // Helper calculators
    const computeFees = (accountKey, methods) => {
      const costsMap = accountKeyToPaymentCosts.get(accountKey) || new Map()
      let fees = 0
      for (const m of methods) {
        const methodName = (m.name || 'other').toLowerCase()
        const revenue = m.sum || 0
        const count = m.count || 0
        const cfg = costsMap.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
        const pctFee = revenue * ((cfg.cost_percentage || 0) / 100)
        const fixedFee = count * (cfg.fixed_cost || 0)
        fees += pctFee + fixedFee
      }
      return fees
    }

    // Aggregation accumulators
    let companyGross = 0
    let companyFees = 0
    let companyFood = 0
    let companyUtilities = 0
    let companyProfit = 0
    let companyPayroll = 0
    let companyTips = 0
    const foodRate = 0.3
    const feesByMethod = {}
    const netByMethod = {}

    const accountsOut = paymentsResults.map((accRes, idx) => {
      const tipsRes = tipsResults[idx]
      if (!accRes.success || !accRes.data?.data) {
        return {
          account: accRes.account,
          accountKey: accRes.accountKey,
          success: false,
          error: accRes.error || 'No data',
          grossSales: 0,
          orders: 0,
          paymentFees: 0,
          netAfterFees: 0,
          foodCosts: 0,
          utilityCosts: 0,
          operatingProfit: 0,
          operatingMargin: 0,
          tips: 0,
          daysInPeriod: daysDiff,
          paymentMethodBreakdown: []
        }
      }
      const methods = accRes.data.data
      const gross = methods.reduce((s, m) => s + (m.sum || 0), 0)
      const orders = methods.reduce((s, m) => s + (m.count || 0), 0)
      const fees = computeFees(accRes.accountKey, methods)
      const netAfterFees = gross - fees
      const food = netAfterFees * foodRate
      const utilDaily = accountKeyToUtility.get(accRes.accountKey)?.total_daily || 0
      const util = utilDaily * daysDiff
      const payrollClosed = accountKeyToPayroll.get(accRes.accountKey)?.payroll_sum || 0
      const payrollClosedEntries = accountKeyToPayroll.get(accRes.accountKey)?.entries_count || 0
      const projected = accountKeyToProjectedPayroll.get(accRes.accountKey)?.projected_payroll_sum || 0
      const projectedEntries = accountKeyToProjectedPayroll.get(accRes.accountKey)?.open_entries_count || 0
      const payrollSum = payrollClosed + projected
      const payrollEntries = payrollClosedEntries + projectedEntries
      const profit = netAfterFees - food - util - payrollSum
      const margin = gross > 0 ? profit / gross : 0
      const tipsAmount = (tipsRes && tipsRes.success && tipsRes.data?.data)
        ? tipsRes.data.data.reduce((s, t) => s + (t.sum || 0), 0)
        : 0

      // Distributions
      const costsMap = accountKeyToPaymentCosts.get(accRes.accountKey) || new Map()
      const paymentMethodBreakdown = []
      for (const m of methods) {
        const method = (m.name || 'other').toLowerCase()
        const revenue = m.sum || 0
        const count = m.count || 0
        const cfg = costsMap.get(method) || { cost_percentage: 0, fixed_cost: 0 }
        const pctFee = revenue * ((cfg.cost_percentage || 0) / 100)
        const fixedFee = count * (cfg.fixed_cost || 0)
        const totalFees = pctFee + fixedFee
        feesByMethod[method] = (feesByMethod[method] || 0) + totalFees
        netByMethod[method] = (netByMethod[method] || 0) + (revenue - totalFees)

        paymentMethodBreakdown.push({
          method,
          revenue,
          fees: totalFees,
          netRevenue: revenue - totalFees,
          transactionCount: count,
          costConfig: cfg
        })
      }

      companyGross += gross
      companyFees += fees
      companyFood += food
      companyUtilities += util
      companyProfit += profit
      companyPayroll += payrollSum
      companyTips += tipsAmount

      return {
        account: accRes.account,
        accountKey: accRes.accountKey,
        success: true,
        grossSales: gross,
        orders,
        paymentFees: fees,
        netAfterFees,
        foodCosts: food,
        utilityCosts: util,
        payrollCosts: payrollSum,
        payrollEntries,
        operatingProfit: profit,
        operatingMargin: margin,
        tips: tipsAmount,
        daysInPeriod: daysDiff,
        paymentMethodBreakdown
      }
    })

    const companyNet = companyGross - companyFees
    const companyMargin = companyGross > 0 ? companyProfit / companyGross : 0
    const feeRate = companyGross > 0 ? companyFees / companyGross : 0
    const tipRate = companyGross > 0 ? companyTips / companyGross : 0

    return res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate, days: daysDiff, timezone },
        company: {
          grossSales: companyGross,
          paymentFees: companyFees,
          netAfterFees: companyNet,
          foodCosts: companyFood,
          utilityCosts: companyUtilities,
          payrollCosts: companyPayroll,
          operatingProfit: companyProfit,
          operatingMargin: companyMargin,
          feeRate,
          tips: companyTips,
          tipRate
        },
        accounts: accountsOut,
        distributions: {
          feesByMethod: feesByMethod,
          netRevenueByMethod: netByMethod
        }
      }
    })
  } catch (error) {
    console.error('❌ Profitability analytics error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Revenue Evolution Chart endpoint - Fetch daily revenue for each account
router.get('/order-evolution', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, timezone: tz } = req.query
    const timezone = tz || 'America/Lima'

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      })
    }

    // Fetch accounts by user's company
    let userAccounts = []
    if (req.user.companyId) {
      const q = await pool.query('SELECT company_token, api_token, public_api_key FROM company_accounts WHERE company_id = $1', [req.user.companyId])
      userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token, public_api_key: r.public_api_key }))
    }

    if (userAccounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        period: { start: start_date, end: end_date, timezone }
      })
    }

    // Generate list of dates between start and end (inclusive)
    const generateDateList = (startStr, endStr) => {
      const dates = []
      const start = new Date(startStr + 'T00:00:00')
      const end = new Date(endStr + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        dates.push(`${yyyy}-${mm}-${dd}`)
      }
      return dates
    }

    const dateList = generateDateList(start_date, end_date)
    console.log('📊 Revenue evolution: fetching', dateList.length, 'days for', userAccounts.length, 'accounts')

    // For each account, fetch revenue for each day
    const accountPromises = userAccounts.map(async (account) => {
      try {
        // Fetch all days in parallel for this account
        const dayPromises = dateList.map(async (date) => {
          const filterParams = {
            'filter[start_date]': date,
            'filter[end_date]': date,
            'filter[timezone]': timezone
          }

          const result = await getPaymentData(account, filterParams)

          if (!result.success || !result.data?.data) {
            return { date, revenue: 0 }
          }

          // Sum revenue from all payment methods
          const methods = result.data.data || []
          const totalRevenue = methods.reduce((sum, m) => sum + (Number(m.sum) || 0), 0)

          return { date, revenue: totalRevenue }
        })

        const dailyData = await Promise.all(dayPromises)

        // Convert to chart format: { label: 'DD-MM-YYYY', revenue: number }
        const chartData = dailyData.map(d => {
          const [yyyy, mm, dd] = d.date.split('-')
          return {
            label: `${dd}-${mm}-${yyyy}`,
            revenue: d.revenue
          }
        })

        return {
          accountKey: account.company_token,
          account: account.company_token,
          success: true,
          data: chartData
        }

      } catch (error) {
        console.error('❌ Error fetching revenue evolution for account', account.company_token, ':', error)
        return {
          accountKey: account.company_token,
          account: account.company_token,
          success: false,
          error: error.message,
          data: []
        }
      }
    })

    const accountsData = await Promise.all(accountPromises)

    console.log('📊 Revenue evolution data for all accounts:', {
      accountCount: accountsData.length,
      successfulAccounts: accountsData.filter(acc => acc.success).length,
      dateRange: `${start_date} to ${end_date}`,
      daysCount: dateList.length
    })

    return res.json({
      success: true,
      accounts: accountsData,
      period: { start: start_date, end: end_date, timezone }
    })

  } catch (error) {
    console.error('❌ Error fetching revenue evolution data:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue evolution data'
    })
  }
})

// ====== DAILY GAINS ENDPOINTS ======

// GET /api/analytics/daily-gains?month=YYYY-MM&company_token=xxx
// Returns stored daily gains for a month. Omit company_token for aggregated view.
router.get('/daily-gains', requireAuth, async (req, res) => {
  try {
    const { month, company_token } = req.query
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month parameter required (YYYY-MM)' })
    }

    const companyId = req.user.companyId
    const startDate = `${month}-01`
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
      .toISOString().split('T')[0] // last day of month

    if (company_token) {
      // Single account
      const result = await pool.query(
        `SELECT date, gross_revenue, payment_fees, food_costs, utility_costs, payroll_costs, net_gain, orders_count, computed_at
         FROM daily_gains
         WHERE company_id = $1 AND company_token = $2 AND date >= $3 AND date <= $4
         ORDER BY date`,
        [companyId, company_token, startDate, endDate]
      )
      return res.json({ success: true, data: result.rows })
    } else {
      // Aggregated across all accounts
      const result = await pool.query(
        `SELECT date,
                SUM(gross_revenue) AS gross_revenue,
                SUM(payment_fees) AS payment_fees,
                SUM(food_costs) AS food_costs,
                SUM(utility_costs) AS utility_costs,
                SUM(payroll_costs) AS payroll_costs,
                SUM(net_gain) AS net_gain,
                SUM(orders_count) AS orders_count,
                MAX(computed_at) AS computed_at
         FROM daily_gains
         WHERE company_id = $1 AND date >= $2 AND date <= $3
         GROUP BY date
         ORDER BY date`,
        [companyId, startDate, endDate]
      )
      return res.json({ success: true, data: result.rows })
    }
  } catch (error) {
    console.error('❌ Daily gains fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/daily-gains/compute
// Manually compute gain for a specific date (optionally for a single account)
router.post('/daily-gains/compute', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { date, company_token } = req.body
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'date parameter required (YYYY-MM-DD)' })
    }

    const companyId = req.user.companyId
    const tzQ = await pool.query('SELECT timezone FROM companies WHERE id = $1', [companyId])
    const timezone = tzQ.rows[0]?.timezone || 'America/Lima'

    let accounts
    if (company_token) {
      accounts = (await pool.query(
        'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1 AND company_token = $2',
        [companyId, company_token]
      )).rows
    } else {
      accounts = (await pool.query(
        'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1',
        [companyId]
      )).rows
    }

    const results = []
    for (const acc of accounts) {
      const result = await computeAndStoreDailyGain(companyId, acc.company_token, acc.api_token, date, timezone)
      if (result) results.push(result)
    }

    return res.json({ success: true, computed: results.length, results })
  } catch (error) {
    console.error('❌ Daily gains compute error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/daily-gains/backfill
// Backfill gains for a date range (max 365 days)
router.post('/daily-gains/backfill', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { start_date, end_date } = req.body
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'start_date and end_date required (YYYY-MM-DD)' })
    }

    const startObj = new Date(start_date)
    const endObj = new Date(end_date)
    const daysDiff = Math.ceil((endObj - startObj) / (1000 * 3600 * 24)) + 1
    if (daysDiff > 365) {
      return res.status(400).json({ success: false, error: 'Maximum 365 days for backfill' })
    }
    if (daysDiff < 1) {
      return res.status(400).json({ success: false, error: 'end_date must be >= start_date' })
    }

    const companyId = req.user.companyId

    // Run backfill in background
    backfillGains(start_date, end_date, companyId).catch(err => {
      console.error('❌ Backfill error:', err.message)
    })

    return res.json({ success: true, message: `Backfill started for ${daysDiff} days. Check server logs for progress.` })
  } catch (error) {
    console.error('❌ Daily gains backfill error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ====== BURGER / COMBO STATS ENDPOINTS ======
// "Burger" = any order line item whose product name contains "combo", "burger",
// or "smash" (case-insensitive) — the unified sale unit, summed by quantity.
// "Combo" is the narrow subset (name contains "combo"). Metrics are derived
// from the per-order ledger `order_facts`, excluding CANCELLED orders and
// counting only orders whose detail has been fetched (burger_units IS NOT NULL).

// GET /api/analytics/daily-combos?month=YYYY-MM&company_token=xxx
// Returns per-day burger + combo stats for a month. Omit company_token for aggregated view.
router.get('/daily-combos', requireAuth, async (req, res) => {
  try {
    const { month, company_token } = req.query
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month parameter required (YYYY-MM)' })
    }

    const companyId = req.user.companyId
    const startDate = `${month}-01`
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
      .toISOString().split('T')[0]

    const params = [companyId, startDate, endDate]
    let tokenClause = ''
    if (company_token) {
      params.push(company_token)
      tokenClause = ` AND company_token = $${params.length}`
    }

    const result = await pool.query(
      `SELECT to_char(day_local, 'YYYY-MM-DD') AS date,
              COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND burger_units IS NOT NULL) AS order_count,
              COALESCE(SUM(burger_units) FILTER (WHERE status <> 'CANCELLED'), 0) AS burger_units,
              COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND has_burger) AS burger_orders,
              COALESCE(SUM(combo_units) FILTER (WHERE status <> 'CANCELLED'), 0) AS combo_units,
              COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND has_combo) AS combo_orders
       FROM order_facts
       WHERE company_id = $1 AND day_local >= $2 AND day_local <= $3
         AND deleted_at IS NULL${tokenClause}
       GROUP BY day_local
       ORDER BY day_local`,
      params
    )

    const data = result.rows.map((r) => {
      const orderCount = Number(r.order_count) || 0
      const burgerUnits = Number(r.burger_units) || 0
      const burgerOrders = Number(r.burger_orders) || 0
      const comboUnits = Number(r.combo_units) || 0
      const comboOrders = Number(r.combo_orders) || 0
      return {
        date: r.date,
        order_count: orderCount,
        // Unified headline metric.
        burger_units: burgerUnits,
        burger_orders: burgerOrders,
        avg_burgers_per_order: orderCount > 0 ? burgerUnits / orderCount : 0,
        burger_order_rate: orderCount > 0 ? burgerOrders / orderCount : 0,
        // Narrow combo subset (kept for comparison).
        combo_units: comboUnits,
        combo_orders: comboOrders,
        avg_combos_per_order: orderCount > 0 ? comboUnits / orderCount : 0,
        combo_order_rate: orderCount > 0 ? comboOrders / orderCount : 0
      }
    })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('❌ Daily combos fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/daily-combos/sync  { date, company_token? }
// Manually sync the combo ledger for a specific date (optionally one account).
router.post('/daily-combos/sync', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { date, company_token } = req.body
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'date parameter required (YYYY-MM-DD)' })
    }
    const companyId = req.user.companyId

    let accounts
    if (company_token) {
      accounts = (await pool.query(
        'SELECT company_token, public_api_key FROM company_accounts WHERE company_id = $1 AND company_token = $2',
        [companyId, company_token]
      )).rows
    } else {
      accounts = (await pool.query(
        'SELECT company_token, public_api_key FROM company_accounts WHERE company_id = $1 AND public_api_key IS NOT NULL',
        [companyId]
      )).rows
    }

    const results = []
    for (const acc of accounts) {
      const r = await syncComboFactsForDay(companyId, acc.company_token, acc.public_api_key, date)
      if (r) results.push({ company_token: acc.company_token, ...r })
    }
    return res.json({ success: true, synced: results.length, results })
  } catch (error) {
    console.error('❌ Daily combos sync error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/daily-combos/backfill  { start_date, end_date }
router.post('/daily-combos/backfill', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const { start_date, end_date } = req.body
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'start_date and end_date required (YYYY-MM-DD)' })
    }
    const startObj = new Date(start_date)
    const endObj = new Date(end_date)
    const daysDiff = Math.ceil((endObj - startObj) / (1000 * 3600 * 24)) + 1
    if (daysDiff > 365) {
      return res.status(400).json({ success: false, error: 'Maximum 365 days for backfill' })
    }
    if (daysDiff < 1) {
      return res.status(400).json({ success: false, error: 'end_date must be >= start_date' })
    }

    const companyId = req.user.companyId
    backfillComboStats(start_date, end_date, companyId).catch((err) => {
      console.error('❌ Combo backfill error:', err.message)
    })
    return res.json({ success: true, message: `Combo backfill started for ${daysDiff} days. Check server logs for progress.` })
  } catch (error) {
    console.error('❌ Daily combos backfill error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/analytics/burgers-by-source?month=YYYY-MM&company_token=xxx
// Double-entry matrix source data: burgers per order per shop per sales channel
// (source). Counts only fetched, non-cancelled orders. Omit company_token for
// all shops in the company. Frontend pivots rows(shop) × cols(source).
router.get('/burgers-by-source', requireAuth, async (req, res) => {
  try {
    const { month, company_token } = req.query
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, error: 'month parameter required (YYYY-MM)' })
    }

    const companyId = req.user.companyId
    const startDate = `${month}-01`
    const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0)
      .toISOString().split('T')[0]

    const params = [companyId, startDate, endDate]
    let tokenClause = ''
    if (company_token) {
      params.push(company_token)
      tokenClause = ` AND cof.company_token = $${params.length}`
    }

    const result = await pool.query(
      `SELECT cof.company_token,
              COALESCE(ca.account_name, cof.company_token) AS account_name,
              COALESCE(cof.source, 'UNKNOWN') AS source,
              COUNT(*) AS order_count,
              COALESCE(SUM(cof.burger_units), 0) AS burger_units,
              COALESCE(SUM(cof.combo_units), 0) AS combo_units
       FROM order_facts cof
       LEFT JOIN company_accounts ca
         ON ca.company_id = cof.company_id AND ca.company_token = cof.company_token
       WHERE cof.company_id = $1
         AND cof.day_local >= $2 AND cof.day_local <= $3
         AND cof.status <> 'CANCELLED'
         AND cof.deleted_at IS NULL
         AND cof.burger_units IS NOT NULL${tokenClause}
       GROUP BY cof.company_token, ca.account_name, cof.source
       ORDER BY account_name, source`,
      params
    )

    const data = result.rows.map((r) => {
      const orderCount = Number(r.order_count) || 0
      const burgerUnits = Number(r.burger_units) || 0
      const comboUnits = Number(r.combo_units) || 0
      return {
        company_token: r.company_token,
        account_name: r.account_name,
        source: r.source,
        order_count: orderCount,
        burger_units: burgerUnits,
        combo_units: comboUnits,
        avg_burgers_per_order: orderCount > 0 ? burgerUnits / orderCount : 0,
        avg_combos_per_order: orderCount > 0 ? comboUnits / orderCount : 0
      }
    })
    return res.json({ success: true, month, data })
  } catch (error) {
    console.error('❌ Burgers-by-source fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ====== DB-BACKED REVENUE / PAYMENT-METHOD ENDPOINTS ======
// These read straight from the order ledger (order_facts + order_payment_facts),
// replacing the private by_payment_methods scrape. Excludes CANCELLED orders.

// GET /api/analytics/payment-methods?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&company_token=xxx
// Revenue by payment method (sum of bill_amount), with tips and fees. This is
// the ledger-backed equivalent of OlaClick's by_payment_methods report.
router.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, company_token } = req.query
    if (!start_date || !end_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return res.status(400).json({ success: false, error: 'start_date and end_date required (YYYY-MM-DD)' })
    }
    const companyId = req.user.companyId
    const params = [companyId, start_date, end_date]
    let tokenClause = ''
    if (company_token) {
      params.push(company_token)
      tokenClause = ` AND p.company_token = $${params.length}`
    }

    const result = await pool.query(
      `SELECT p.method AS name,
              COUNT(*) AS count,
              COALESCE(SUM(p.bill_amount), 0) AS sum,
              COALESCE(SUM(p.tip_amount), 0) AS tips,
              COALESCE(SUM(p.fee_amount), 0) AS fees
       FROM order_payment_facts p
       JOIN order_facts o
         ON o.company_token = p.company_token AND o.order_id = p.order_id
       WHERE p.company_id = $1
         AND p.day_local >= $2 AND p.day_local <= $3
         AND o.status <> 'CANCELLED'
         AND o.deleted_at IS NULL${tokenClause}
       GROUP BY p.method
       ORDER BY sum DESC`,
      params
    )

    const data = result.rows.map((r) => ({
      name: r.name,
      count: Number(r.count) || 0,
      sum: Number(r.sum) || 0,
      tips: Number(r.tips) || 0,
      fees: Number(r.fees) || 0
    }))
    const totalAmount = data.reduce((s, m) => s + m.sum, 0)
    for (const m of data) m.percent = totalAmount > 0 ? (m.sum / totalAmount) * 100 : 0

    return res.json({
      success: true,
      data,
      totals: {
        amount: totalAmount,
        payments: data.reduce((s, m) => s + m.count, 0),
        tips: data.reduce((s, m) => s + m.tips, 0),
        fees: data.reduce((s, m) => s + m.fees, 0)
      }
    })
  } catch (error) {
    console.error('❌ Payment-methods fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/analytics/revenue?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&company_token=xxx
// Per-day revenue rollup from the order ledger (gross, paid, tips, discounts,
// service fee, order count). Excludes CANCELLED orders.
router.get('/revenue', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, company_token } = req.query
    if (!start_date || !end_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      return res.status(400).json({ success: false, error: 'start_date and end_date required (YYYY-MM-DD)' })
    }
    const companyId = req.user.companyId
    const params = [companyId, start_date, end_date]
    let tokenClause = ''
    if (company_token) {
      params.push(company_token)
      tokenClause = ` AND company_token = $${params.length}`
    }

    const result = await pool.query(
      `SELECT to_char(day_local, 'YYYY-MM-DD') AS date,
              COUNT(*) AS order_count,
              COALESCE(SUM(order_total), 0) AS gross_total,
              COALESCE(SUM(total_paid), 0) AS total_paid,
              COALESCE(SUM(tips_total), 0) AS tips_total,
              COALESCE(SUM(discounts_total), 0) AS discounts_total,
              COALESCE(SUM(service_fee), 0) AS service_fee
       FROM order_facts
       WHERE company_id = $1 AND day_local >= $2 AND day_local <= $3
         AND status <> 'CANCELLED'
         AND deleted_at IS NULL${tokenClause}
       GROUP BY day_local
       ORDER BY day_local`,
      params
    )

    const data = result.rows.map((r) => {
      const orderCount = Number(r.order_count) || 0
      const gross = Number(r.gross_total) || 0
      return {
        date: r.date,
        order_count: orderCount,
        gross_total: gross,
        total_paid: Number(r.total_paid) || 0,
        tips_total: Number(r.tips_total) || 0,
        discounts_total: Number(r.discounts_total) || 0,
        service_fee: Number(r.service_fee) || 0,
        average_ticket: orderCount > 0 ? gross / orderCount : 0
      }
    })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('❌ Revenue fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/analytics/daily-record?date=YYYY-MM-DD&timezone=...
// Returns the "record to beat" for the weekday of `date` (defaults to today),
// based on the highest single-day sales (gross_revenue) observed for that same
// weekday over the previous 3 months. The target day itself is excluded so an
// in-progress day never becomes its own record. Returned both at company level
// (sum across accounts per day) and per account.
router.get('/daily-record', requireAuth, async (req, res) => {
  try {
    const companyId = req.user.companyId

    let timezone = req.query.timezone || req.query?.filter?.timezone
    if (!timezone) {
      const tzQ = await pool.query('SELECT timezone FROM companies WHERE id = $1', [companyId])
      timezone = tzQ.rows[0]?.timezone || 'America/Lima'
    }

    let date = req.query.date
    date = (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
      ? getTimezoneAwareDate(date, timezone)
      : getTimezoneAwareDate(null, timezone)

    // 3-month look-back window, excluding the target day itself
    const windowRes = await pool.query(
      `SELECT to_char(($1::date - INTERVAL '3 months')::date, 'YYYY-MM-DD') AS start,
              to_char(($1::date - INTERVAL '1 day')::date, 'YYYY-MM-DD') AS "end"`,
      [date]
    )
    const windowStart = windowRes.rows[0].start
    const windowEnd = windowRes.rows[0].end

    // Company-level record: highest single-day total sales among matching weekdays
    const companyRes = await pool.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date, SUM(gross_revenue) AS gross
       FROM daily_gains
       WHERE company_id = $1
         AND date >= $2 AND date <= $3
         AND EXTRACT(DOW FROM date) = EXTRACT(DOW FROM $4::date)
       GROUP BY date
       ORDER BY gross DESC
       LIMIT 1`,
      [companyId, windowStart, windowEnd, date]
    )
    const companyRecord = companyRes.rows[0]
      ? { record: Number(companyRes.rows[0].gross) || 0, date: companyRes.rows[0].date }
      : { record: 0, date: null }

    // Per-account record: highest single-day sales per account among matching weekdays
    const accountsRes = await pool.query(
      `SELECT DISTINCT ON (dg.company_token)
              dg.company_token,
              ca.account_name,
              to_char(dg.date, 'YYYY-MM-DD') AS date,
              dg.gross_revenue AS gross
       FROM daily_gains dg
       LEFT JOIN company_accounts ca
         ON ca.company_id = dg.company_id AND ca.company_token = dg.company_token
       WHERE dg.company_id = $1
         AND dg.date >= $2 AND dg.date <= $3
         AND EXTRACT(DOW FROM dg.date) = EXTRACT(DOW FROM $4::date)
       ORDER BY dg.company_token, dg.gross_revenue DESC`,
      [companyId, windowStart, windowEnd, date]
    )
    const accounts = accountsRes.rows.map(r => ({
      accountKey: r.company_token,
      account: r.account_name || r.company_token,
      record: Number(r.gross) || 0,
      date: r.date
    }))

    return res.json({
      success: true,
      data: {
        date,
        weekday: new Date(date + 'T00:00:00').getDay(), // 0=Sun..6=Sat
        window: { start: windowStart, end: windowEnd },
        company: companyRecord,
        accounts
      }
    })
  } catch (error) {
    console.error('❌ Daily record fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/analytics/store-status
// Live open/closed state of each account on Rappi / Rappi Turbo / PedidosYa
// (OlaClick public API). One account failing does not fail the rest. Accounts
// without a public_api_key, or whose key is missing `stores:read`, come back
// with `available: false` so the UI can stay quiet rather than error.
router.get('/store-status', requireAuth, async (req, res) => {
  try {
    const companyId = req.user.companyId
    const cached = storeStatusCache.get(companyId)
    if (cached && Date.now() < cached.expiresAt) {
      return res.json({ success: true, data: cached.data })
    }

    const q = await pool.query(
      `SELECT company_token, account_name, public_api_key
       FROM company_accounts
       WHERE company_id = $1
       ORDER BY account_name`,
      [companyId]
    )

    const accounts = await Promise.all(q.rows.map(async (acc) => {
      const base = {
        accountKey: acc.company_token,
        account: acc.account_name || acc.company_token,
        providers: [],
        available: false
      }
      if (!acc.public_api_key) {
        return { ...base, error: 'no_key' }
      }
      try {
        const providers = await fetchStoreStatus(acc.public_api_key, {
          providerNames: STORE_STATUS_PROVIDERS
        })
        return { ...base, providers, available: true }
      } catch (err) {
        const status = Number(err?.status)
        const error = status === 403 ? 'missing_scope' : 'fetch_failed'
        console.warn(
          `⚠️ Store status ${acc.company_token}: ${error} (${err.message})`
        )
        return { ...base, error }
      }
    }))

    const data = { accounts }
    storeStatusCache.set(companyId, { data, expiresAt: Date.now() + STORE_STATUS_TTL_MS })
    return res.json({ success: true, data })
  } catch (error) {
    console.error('❌ Store status fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Percentage change, or null when the baseline can't support one (zero or a
// loss). Callers render null as "—" rather than inventing an infinite gain.
const percentChange = (current, previous) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null
  return ((current - previous) / previous) * 100
}

// Turns two windows of raw totals into the derived metrics and their deltas.
// Margin is compared in percentage points; everything else in % and absolutes.
function buildGrowthMetrics(cur, prev) {
  const derive = (t) => ({
    grossRevenue: t.grossRevenue,
    orders: t.orders,
    netGain: t.netGain,
    avgTicket: t.orders > 0 ? t.grossRevenue / t.orders : 0,
    margin: t.grossRevenue > 0 ? (t.netGain / t.grossRevenue) * 100 : 0
  })
  const current = derive(cur)
  const previous = derive(prev)

  return {
    current,
    previous,
    change: {
      grossRevenue: {
        abs: current.grossRevenue - previous.grossRevenue,
        pct: percentChange(current.grossRevenue, previous.grossRevenue)
      },
      orders: {
        abs: current.orders - previous.orders,
        pct: percentChange(current.orders, previous.orders)
      },
      avgTicket: {
        abs: current.avgTicket - previous.avgTicket,
        pct: percentChange(current.avgTicket, previous.avgTicket)
      },
      netGain: {
        abs: current.netGain - previous.netGain,
        pct: percentChange(current.netGain, previous.netGain)
      },
      margin: { abs: current.margin - previous.margin, pct: null }
    },
    // orders_count is backfilled separately from revenue, so a window can hold
    // revenue with no order counts. Ticket and order deltas are junk if so.
    ordersReliable: cur.orders > 0 && prev.orders > 0
  }
}

// GET /api/analytics/growth?timezone=...&weeks=13
// Period-over-period growth: the last N whole weeks vs the N weeks before them.
//
// Whole weeks (not calendar months or "last 90 days") are deliberate: both
// windows then contain exactly the same number of Mondays, Saturdays, etc., so a
// difference can't be an artifact of which weekdays each window happened to
// catch. Today is excluded entirely — a day in progress would drag the current
// window down and make the business look like it is always shrinking.
router.get('/growth', requireAuth, async (req, res) => {
  try {
    const companyId = req.user.companyId

    let timezone = req.query.timezone || req.query?.filter?.timezone
    if (!timezone) {
      const tzQ = await pool.query('SELECT timezone FROM companies WHERE id = $1', [companyId])
      timezone = tzQ.rows[0]?.timezone || 'America/Lima'
    }

    const weeks = Math.min(26, Math.max(1, parseInt(req.query.weeks, 10) || 13))
    const days = weeks * 7
    const today = getTimezoneAwareDate(null, timezone)

    // Resolve both window boundaries in SQL so date math never drifts.
    const boundsRes = await pool.query(
      `SELECT to_char($1::date - 1, 'YYYY-MM-DD')             AS cur_end,
              to_char($1::date - $2::int, 'YYYY-MM-DD')       AS cur_start,
              to_char($1::date - $2::int - 1, 'YYYY-MM-DD')   AS prev_end,
              to_char($1::date - (2 * $2::int), 'YYYY-MM-DD') AS prev_start`,
      [today, days]
    )
    const { cur_end: curEnd, cur_start: curStart, prev_end: prevEnd, prev_start: prevStart } = boundsRes.rows[0]

    // One pass over the whole 2N-week span, bucketed into 7-day blocks counted
    // back from cur_end. Bucket 0 is the most recent week, so buckets
    // 0..weeks-1 are the current window and weeks..2*weeks-1 the previous one.
    // The buckets therefore sum exactly to the window totals.
    const bucketsRes = await pool.query(
      `SELECT (($2::date - date) / 7)             AS bucket,
              to_char(MIN(date), 'YYYY-MM-DD')    AS week_start,
              to_char(MAX(date), 'YYYY-MM-DD')    AS week_end,
              SUM(gross_revenue)                  AS gross,
              SUM(orders_count)                   AS orders,
              SUM(net_gain)                       AS net_gain
       FROM daily_gains
       WHERE company_id = $1 AND date >= $3 AND date <= $2
       GROUP BY bucket
       ORDER BY bucket DESC`, // highest bucket = furthest back, so this is chronological
      [companyId, curEnd, prevStart]
    )

    const emptyTotals = () => ({ grossRevenue: 0, orders: 0, netGain: 0 })
    const companyCur = emptyTotals()
    const companyPrev = emptyTotals()
    const weekly = []

    for (const row of bucketsRes.rows) {
      const bucket = Number(row.bucket)
      const gross = Number(row.gross) || 0
      const orders = Number(row.orders) || 0
      const netGain = Number(row.net_gain) || 0
      const inCurrent = bucket < weeks

      const target = inCurrent ? companyCur : companyPrev
      target.grossRevenue += gross
      target.orders += orders
      target.netGain += netGain

      weekly.push({
        weekStart: row.week_start,
        weekEnd: row.week_end,
        grossRevenue: gross,
        orders,
        netGain,
        inCurrent
      })
    }

    // Per-account totals for both windows in a single scan.
    const accountsRes = await pool.query(
      `SELECT dg.company_token,
              ca.account_name,
              SUM(CASE WHEN dg.date >= $4 THEN dg.gross_revenue ELSE 0 END) AS cur_gross,
              SUM(CASE WHEN dg.date >= $4 THEN dg.orders_count  ELSE 0 END) AS cur_orders,
              SUM(CASE WHEN dg.date >= $4 THEN dg.net_gain      ELSE 0 END) AS cur_net_gain,
              SUM(CASE WHEN dg.date <  $4 THEN dg.gross_revenue ELSE 0 END) AS prev_gross,
              SUM(CASE WHEN dg.date <  $4 THEN dg.orders_count  ELSE 0 END) AS prev_orders,
              SUM(CASE WHEN dg.date <  $4 THEN dg.net_gain      ELSE 0 END) AS prev_net_gain,
              -- Trading days in the baseline. A location that was only open a
              -- handful of days produces a tiny denominator, and a percentage
              -- off it (+800%) says more about the opening date than the trend.
              COUNT(DISTINCT dg.date) FILTER (WHERE dg.date < $4 AND dg.gross_revenue > 0) AS prev_active_days
       FROM daily_gains dg
       LEFT JOIN company_accounts ca
         ON ca.company_id = dg.company_id AND ca.company_token = dg.company_token
       WHERE dg.company_id = $1 AND dg.date >= $3 AND dg.date <= $2
       GROUP BY dg.company_token, ca.account_name`,
      [companyId, curEnd, prevStart, curStart]
    )

    // How much of the previous window we actually hold. Without this a fresh
    // install shows spectacular "growth" that is really just missing history.
    const coverageRes = await pool.query(
      `SELECT to_char(MIN(date), 'YYYY-MM-DD') AS data_start,
              COUNT(DISTINCT date) FILTER (WHERE date >= $2 AND date <= $3) AS prev_days
       FROM daily_gains
       WHERE company_id = $1`,
      [companyId, prevStart, prevEnd]
    )
    const prevDaysPresent = Number(coverageRes.rows[0]?.prev_days) || 0

    return res.json({
      success: true,
      data: {
        window: {
          weeks,
          days,
          current: { start: curStart, end: curEnd },
          previous: { start: prevStart, end: prevEnd }
        },
        coverage: {
          dataStart: coverageRes.rows[0]?.data_start || null,
          previousDaysPresent: prevDaysPresent,
          previousComplete: prevDaysPresent >= days
        },
        company: buildGrowthMetrics(companyCur, companyPrev),
        weekly, // chronological: oldest week first
        accounts: accountsRes.rows
          .map(r => {
            const cur = {
              grossRevenue: Number(r.cur_gross) || 0,
              orders: Number(r.cur_orders) || 0,
              netGain: Number(r.cur_net_gain) || 0
            }
            const prev = {
              grossRevenue: Number(r.prev_gross) || 0,
              orders: Number(r.prev_orders) || 0,
              netGain: Number(r.prev_net_gain) || 0
            }
            const prevActiveDays = Number(r.prev_active_days) || 0
            return {
              accountKey: r.company_token,
              account: r.account_name || r.company_token,
              // No revenue at all in the earlier window means a location that
              // opened mid-span: a percentage would be meaningless there.
              isNew: prev.grossRevenue <= 0 && cur.grossRevenue > 0,
              // Open for less than half the baseline: growing off a partial
              // window, so the absolute change is the only honest figure.
              isRamping: prev.grossRevenue > 0 && prevActiveDays < days / 2,
              previousActiveDays: prevActiveDays,
              ...buildGrowthMetrics(cur, prev)
            }
          })
          // Nothing in either window means the location simply wasn't trading.
          .filter(a => a.current.grossRevenue !== 0 || a.previous.grossRevenue !== 0)
          .sort((a, b) => b.current.grossRevenue - a.current.grossRevenue)
      }
    })
  } catch (error) {
    console.error('❌ Growth fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/analytics/achievements?scope=company|account&company_token=xxx
// Returns the mixed badge list (earned + upcoming) for the current period.
router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const scope = req.query.scope === 'account' ? 'account' : 'company'
    const companyToken = req.query.company_token || null
    if (scope === 'account' && !companyToken) {
      return res.status(400).json({ success: false, error: 'company_token required for account scope' })
    }
    const badges = await getBadges(req.user.companyId, scope, companyToken)
    return res.json({ success: true, data: badges })
  } catch (error) {
    console.error('❌ Achievements fetch error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/achievements/evaluate
// Force a re-evaluation of the trophy case for the given months (admin only).
router.post('/achievements/evaluate', requireAuth, requireRole(['admin', 'super-admin']), async (req, res) => {
  try {
    const months = Array.isArray(req.body?.months) && req.body.months.length
      ? req.body.months
      : [`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`]
    const unlocked = await evaluateCompanyMonths(req.user.companyId, months)
    return res.json({ success: true, unlocked })
  } catch (error) {
    console.error('❌ Achievements evaluate error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

