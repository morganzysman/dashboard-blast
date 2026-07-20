// Ledger-backed read layer.
//
// Serves the dashboard's revenue / payment-method / tips / service-type metrics
// from the local per-order ledger (order_facts + order_payment_facts) instead of
// the private cookie API (api.olaclick.app), which throttles ("Too Many
// Attempts."). The ledger is refreshed every 5 minutes from the Public API, so
// figures are at most ~5 minutes behind live — acceptable for a dashboard.
//
// Each exported function MIRRORS the shape of its cookie-based counterpart in
// olaClickService.js so callers/aggregators need no shape changes:
//   getRevenueIndicators  <-> fetchGeneralIndicators
//   getServiceMetrics     <-> fetchServiceMetrics
//   getPaymentData        <-> fetchOlaClickData
//   getTipsData           <-> fetchTipsData
//
// Dispatch rule: accounts that have a public_api_key are served from the ledger.
// Accounts WITHOUT a key fall back to the cookie API (so nothing breaks while
// keys are still being provisioned). CANCELLED orders are excluded everywhere.

import { pool } from '../database.js'
// Cookie-API fallback (temporarily disabled — see the commented guards below).
// Kept imported/commented so the fallback can be restored quickly if needed.
// import {
//   fetchGeneralIndicators,
//   fetchServiceMetrics,
//   fetchOlaClickData,
//   fetchTipsData
// } from './olaClickService.js'

const SERVICE_TYPES = ['TABLE', 'ONSITE', 'TAKEAWAY', 'DELIVERY']

function hasKey(account) {
  return !!(account && account.public_api_key)
}

function accountLabel(account) {
  return account?.account_name || account?.name || account?.company_token
}

// Accept either the fetchGeneralIndicators convention ({ startDate, endDate }) or
// the fetchOlaClickData convention ({ 'filter[start_date]', 'filter[end_date]' }).
function parseRange(params = {}) {
  return {
    startDate: params.startDate || params['filter[start_date]'],
    endDate: params.endDate || params['filter[end_date]']
  }
}

/**
 * Revenue indicators for an account over [startDate, endDate].
 * Mirrors fetchGeneralIndicators: { success, data: { orders, sales, averageTicket }, account, accountKey }.
 *
 * NOTE: unlike the old cookie path (which counted CANCELLED orders in its status
 * filter), the ledger excludes CANCELLED — so counts/sales can be marginally
 * lower but more correct.
 */
export async function getRevenueIndicators(account, params = {}) {
  // Cookie fallback disabled — always read from the ledger.
  // if (!hasKey(account)) return fetchGeneralIndicators(account, params)
  const { startDate, endDate } = parseRange(params)
  try {
    const res = await pool.query(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(order_total), 0) AS sales
       FROM order_facts
       WHERE company_token = $1 AND day_local >= $2 AND day_local <= $3
         AND status <> 'CANCELLED'`,
      [account.company_token, startDate, endDate]
    )
    const orders = Number(res.rows[0]?.orders) || 0
    const sales = Number(res.rows[0]?.sales) || 0
    return {
      success: true,
      data: { orders, sales, averageTicket: orders > 0 ? sales / orders : 0 },
      account: accountLabel(account),
      accountKey: account.company_token
    }
  } catch (error) {
    console.error(`❌ ledger revenue error for ${account.company_token}: ${error.message}`)
    return { success: false, error: error.message, account: accountLabel(account), accountKey: account.company_token }
  }
}

/**
 * Per-service-type metrics for an account over [startDate, endDate].
 * Mirrors fetchServiceMetrics' consumed shape:
 *   { success, data: { data: { TABLE:{orders:{current_period},sales:{current_period},average_ticket:{current_period}}, ... } }, account, accountKey }
 */
export async function getServiceMetrics(account, params = {}) {
  // Cookie fallback disabled — always read from the ledger.
  // if (!hasKey(account)) return fetchServiceMetrics(account, params)
  const { startDate, endDate } = parseRange(params)
  try {
    const res = await pool.query(
      `SELECT service_type,
              COUNT(*) AS orders,
              COALESCE(SUM(order_total), 0) AS sales
       FROM order_facts
       WHERE company_token = $1 AND day_local >= $2 AND day_local <= $3
         AND status <> 'CANCELLED'
       GROUP BY service_type`,
      [account.company_token, startDate, endDate]
    )
    const data = {}
    for (const t of SERVICE_TYPES) {
      data[t] = {
        orders: { current_period: 0 },
        sales: { current_period: 0 },
        average_ticket: { current_period: 0 }
      }
    }
    for (const row of res.rows) {
      const type = (row.service_type || '').toUpperCase()
      if (!data[type]) continue
      const orders = Number(row.orders) || 0
      const sales = Number(row.sales) || 0
      data[type] = {
        orders: { current_period: orders },
        sales: { current_period: sales },
        average_ticket: { current_period: orders > 0 ? sales / orders : 0 }
      }
    }
    return { success: true, data: { data }, account: accountLabel(account), accountKey: account.company_token }
  } catch (error) {
    console.error(`❌ ledger service-metrics error for ${account.company_token}: ${error.message}`)
    return { success: false, error: error.message, account: accountLabel(account), accountKey: account.company_token }
  }
}

/**
 * Payment-method breakdown for an account over [startDate, endDate].
 * Mirrors fetchOlaClickData: { success, data: { data: [{ name, count, sum }] }, account, accountKey }.
 * `sum` is the amount applied to the bill (order_payment_facts.bill_amount),
 * which matches the private by_payment_methods aggregator across split payments.
 */
export async function getPaymentData(account, params = {}) {
  // Cookie fallback disabled — always read from the ledger.
  // if (!hasKey(account)) return fetchOlaClickData(account, params)
  const { startDate, endDate } = parseRange(params)
  try {
    const res = await pool.query(
      `SELECT p.method AS name,
              COUNT(*) AS count,
              COALESCE(SUM(p.bill_amount), 0) AS sum
       FROM order_payment_facts p
       JOIN order_facts o
         ON o.company_token = p.company_token AND o.order_id = p.order_id
       WHERE p.company_token = $1 AND p.day_local >= $2 AND p.day_local <= $3
         AND o.status <> 'CANCELLED'
       GROUP BY p.method
       ORDER BY sum DESC`,
      [account.company_token, startDate, endDate]
    )
    const data = res.rows.map((r) => ({
      name: r.name,
      count: Number(r.count) || 0,
      sum: Number(r.sum) || 0
    }))
    return { success: true, data: { data }, account: accountLabel(account), accountKey: account.company_token }
  } catch (error) {
    console.error(`❌ ledger payments error for ${account.company_token}: ${error.message}`)
    return { success: false, error: error.message, account: accountLabel(account), accountKey: account.company_token }
  }
}

/**
 * Tips total for an account over [startDate, endDate].
 * Mirrors fetchTipsData: { success, data: { data: [{ sum }] }, account, accountKey }.
 * Returned as a single aggregated row since callers only sum `tip.sum`.
 */
export async function getTipsData(account, params = {}) {
  // Cookie fallback disabled — always read from the ledger.
  // if (!hasKey(account)) return fetchTipsData(account, params)
  const { startDate, endDate } = parseRange(params)
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(tips_total), 0) AS sum
       FROM order_facts
       WHERE company_token = $1 AND day_local >= $2 AND day_local <= $3
         AND status <> 'CANCELLED'`,
      [account.company_token, startDate, endDate]
    )
    const tips = Number(res.rows[0]?.sum) || 0
    return {
      success: true,
      data: { data: tips > 0 ? [{ sum: tips }] : [] },
      account: accountLabel(account),
      accountKey: account.company_token
    }
  } catch (error) {
    console.error(`❌ ledger tips error for ${account.company_token}: ${error.message}`)
    return { success: false, error: error.message, account: accountLabel(account), accountKey: account.company_token }
  }
}
