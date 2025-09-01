import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'
import { fetchOlaClickData, fetchTipsData, getTimezoneAwareDate } from '../services/olaClickService.js'

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
      const q = await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [req.user.companyId])
      userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token }))
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

    const paymentsPromises = userAccounts.map(acc => fetchOlaClickData(acc, filterParams))
    const tipsPromises = userAccounts.map(acc => fetchTipsData(acc, filterParams))
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

// Order Evolution Chart endpoint - Fetch data for each account individually
router.get('/order-evolution', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, timezone } = req.query
    
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      })
    }

    // Fetch accounts by user's company
    let userAccounts = []
    if (req.user.companyId) {
      const q = await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [req.user.companyId])
      userAccounts = q.rows.map(r => ({ company_token: r.company_token, api_token: r.api_token }))
    }
    
    if (userAccounts.length === 0) {
      return res.json({
        success: true,
        accounts: [],
        period: {
          start: start_date,
          end: end_date,
          timezone: timezone || 'America/Lima'
        }
      })
    }

    // Import the OlaClick service functions
    const { constructCookieHeader } = await import('../services/olaClickService.js')

    // Fetch evolution data for each account in parallel
    const evolutionPromises = userAccounts.map(async (account) => {
      try {
        // Build the OlaClick API URL for this account
        const url = new URL('https://api.olaclick.app/ms-reports/auth/dashboard/general_indicators/evolution_chart')
        url.searchParams.set('filter[start_date]', start_date)
        url.searchParams.set('filter[end_date]', end_date)
        url.searchParams.set('filter[start_time]', '00:00:00')
        url.searchParams.set('filter[end_time]', '23:59:59')
        url.searchParams.set('filter[sources]', 'INBOUND,OUTBOUND')
        url.searchParams.set('timezone', timezone || 'America/Lima')

        // Construct cookie header for authentication
        let cookieHeader
        try {
          cookieHeader = constructCookieHeader(account)
        } catch (cookieError) {
          console.error('❌ Cookie construction failed for account', account.company_token, ':', cookieError.message)
          return {
            accountKey: account.company_token,
            account: account.company_token,
            success: false,
            error: 'Authentication setup failed',
            data: []
          }
        }

        console.log('📊 Fetching order evolution data from OlaClick for account:', {
          start_date,
          end_date,
          timezone,
          account: account.company_token,
          url: url.toString()
        })

        // Prepare headers with proper OlaClick authentication
        const headers = {
          'accept': 'application/json,multipart/form-data',
          'accept-language': 'en-US,en;q=0.8',
          'app-company-token': account.company_token,
          'content-type': 'application/json',
          'cookie': cookieHeader,
          'origin': 'https://orders.olaclick.app',
          'referer': 'https://orders.olaclick.app/',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
        }

        // Make the request to OlaClick API
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers
        })

        if (!response.ok) {
          console.error('❌ OlaClick API error for account', account.company_token, ':', response.status, response.statusText)
          
          // Try to get the response body for more details
          let errorDetails = 'No error details available'
          try {
            const errorResponse = await response.text()
            console.error('❌ OlaClick API error response body for account', account.company_token, ':', errorResponse)
            errorDetails = errorResponse
          } catch (textError) {
            console.error('❌ Could not read error response body for account', account.company_token, ':', textError.message)
          }
          
          return {
            accountKey: account.company_token,
            account: account.company_token,
            success: false,
            error: `OlaClick API error: ${response.status} ${response.statusText}`,
            details: errorDetails,
            data: []
          }
        }

        const data = await response.json()
        
        console.log('📊 Order evolution data received from OlaClick for account', account.company_token, ':', {
          dataPoints: data.data?.length || 0,
          dateRange: `${start_date} to ${end_date}`
        })

        return {
          accountKey: account.company_token,
          account: account.company_token,
          success: true,
          data: data.data || []
        }

      } catch (error) {
        console.error('❌ Error fetching order evolution data for account', account.company_token, ':', error)
        return {
          accountKey: account.company_token,
          account: account.company_token,
          success: false,
          error: 'Failed to fetch order evolution data',
          data: []
        }
      }
    })

    const accountsData = await Promise.all(evolutionPromises)
    
    console.log('📊 Order evolution data for all accounts:', {
      accountCount: accountsData.length,
      successfulAccounts: accountsData.filter(acc => acc.success).length,
      dateRange: `${start_date} to ${end_date}`
    })

    return res.json({
      success: true,
      accounts: accountsData,
      period: {
        start: start_date,
        end: end_date,
        timezone: timezone || 'America/Lima'
      }
    })

  } catch (error) {
    console.error('❌ Error fetching order evolution data:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch order evolution data'
    })
  }
})

export default router

