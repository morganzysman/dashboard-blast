import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pool } from '../database.js'
import { fetchOlaClickData, fetchTipsData, getTimezoneAwareDate } from '../services/olaClickService.js'

const router = Router()

// GET /api/analytics/profitability
// Aggregates profitability metrics across user's accounts for a given date range
router.get('/profitability', requireAuth, async (req, res) => {
  try {
    // Normalize filter params like other routes
    let currentParams = {}
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const paramName = key.slice(7, -1)
        currentParams[`filter[${paramName}]`] = req.query[key]
      } else {
        currentParams[key] = req.query[key]
      }
    })

    const timezone = currentParams['filter[timezone]'] || req.user.userTimezone || 'America/Lima'
    let startDate = currentParams['filter[start_date]']
    let endDate = currentParams['filter[end_date]']

    if (!startDate || !endDate) {
      const today = getTimezoneAwareDate(null, timezone)
      startDate = today
      endDate = today
    }

    // Calculate days in period
    const startObj = new Date(startDate)
    const endObj = new Date(endDate)
    const daysDiff = Math.max(1, Math.ceil((endObj.getTime() - startObj.getTime()) / (1000 * 3600 * 24)) + 1)

    const userAccounts = req.user.userAccounts || []
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
      WHERE user_id = $1 AND company_token IN (${accPlaceholders})
    `
    const paymentCostsQuery = `
      SELECT company_token, payment_method_code, cost_percentage, fixed_cost
      FROM payment_method_costs
      WHERE user_id = $1 AND company_token IN (${accPlaceholders})
    `

    const [utilityRes, paymentCostsRes] = await Promise.all([
      pool.query(utilityQuery, [req.user.userId, ...accountTokens]),
      pool.query(paymentCostsQuery, [req.user.userId, ...accountTokens])
    ])

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
          tips: 0
        }
      }
      const methods = accRes.data.data
      const gross = methods.reduce((s, m) => s + (m.sum || 0), 0)
      const orders = methods.reduce((s, m) => s + (m.count || 0), 0)
      const fees = computeFees(accRes.accountKey, methods)
      const netAfterFees = gross - fees
      const food = gross * foodRate
      const utilDaily = accountKeyToUtility.get(accRes.accountKey)?.total_daily || 0
      const util = utilDaily * daysDiff
      const profit = netAfterFees - food - util
      const margin = gross > 0 ? profit / gross : 0
      const tipsAmount = (tipsRes && tipsRes.success && tipsRes.data?.data)
        ? tipsRes.data.data.reduce((s, t) => s + (t.sum || 0), 0)
        : 0

      // Distributions
      const costsMap = accountKeyToPaymentCosts.get(accRes.accountKey) || new Map()
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
      }

      companyGross += gross
      companyFees += fees
      companyFood += food
      companyUtilities += util
      companyProfit += profit
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
        operatingProfit: profit,
        operatingMargin: margin,
        tips: tipsAmount
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

export default router

