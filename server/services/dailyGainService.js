import cron from 'node-cron'
import { pool } from '../database.js'
import { fetchOlaClickData, getTimezoneAwareDate } from './olaClickService.js'

const FOOD_COST_RATE = 0.3

// Sleep helper for throttling
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Compute and store daily gain for a single account on a single date
export async function computeAndStoreDailyGain(companyId, companyToken, apiToken, date, timezone) {
  const account = { company_token: companyToken, api_token: apiToken }
  const filterParams = {
    'filter[start_date]': date,
    'filter[end_date]': date,
    'filter[timezone]': timezone
  }

  // Fetch revenue from OlaClick API
  let gross = 0
  let ordersCount = 0
  let methods = []
  try {
    const result = await fetchOlaClickData(account, filterParams)
    if (result.success && result.data?.data) {
      methods = result.data.data
      gross = methods.reduce((s, m) => s + (Number(m.sum) || 0), 0)
      ordersCount = methods.reduce((s, m) => s + (Number(m.count) || 0), 0)
    }
  } catch (err) {
    console.error(`  ❌ OlaClick API error for ${companyToken} on ${date}:`, err.message)
    return null
  }

  // Fetch payment method costs from DB
  const pmRes = await pool.query(
    'SELECT payment_method_code, cost_percentage, fixed_cost FROM payment_method_costs WHERE company_id = $1 AND company_token = $2',
    [companyId, companyToken]
  )
  const pmCosts = new Map()
  pmRes.rows.forEach(r => pmCosts.set((r.payment_method_code || '').toLowerCase(), r))

  // Compute payment fees
  let paymentFees = 0
  for (const m of methods) {
    const methodName = (m.name || 'other').toLowerCase()
    const revenue = Number(m.sum) || 0
    const count = Number(m.count) || 0
    const cfg = pmCosts.get(methodName) || { cost_percentage: 0, fixed_cost: 0 }
    paymentFees += revenue * ((cfg.cost_percentage || 0) / 100) + count * (cfg.fixed_cost || 0)
  }

  // Fetch utility costs from DB
  const utilRes = await pool.query(
    'SELECT total_daily FROM utility_costs WHERE company_id = $1 AND company_token = $2',
    [companyId, companyToken]
  )
  const utilityDailyCost = Number(utilRes.rows[0]?.total_daily) || 0

  // Fetch payroll costs for this date
  const payrollRes = await pool.query(`
    SELECT COALESCE(SUM(
      COALESCE(te.amount, (EXTRACT(EPOCH FROM (te.clock_out_at - te.clock_in_at)) / 3600.0) * COALESCE(u.hourly_rate, 0))
    ), 0) AS payroll_sum
    FROM time_entries te
    LEFT JOIN users u ON u.id = te.user_id
    WHERE te.clock_in_at >= $1::date
      AND te.clock_in_at < ($1::date + INTERVAL '1 day')
      AND te.clock_out_at IS NOT NULL
      AND te.company_token = $2
  `, [date, companyToken])
  const payrollCosts = Number(payrollRes.rows[0]?.payroll_sum) || 0

  // Compute gain
  const netAfterFees = gross - paymentFees
  const foodCosts = netAfterFees * FOOD_COST_RATE
  const netGain = netAfterFees - foodCosts - utilityDailyCost - payrollCosts

  // Upsert into daily_gains
  await pool.query(`
    INSERT INTO daily_gains (company_id, company_token, date, gross_revenue, payment_fees, food_costs, utility_costs, payroll_costs, net_gain, orders_count, computed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, company_token, date) DO UPDATE SET
      gross_revenue = EXCLUDED.gross_revenue,
      payment_fees = EXCLUDED.payment_fees,
      food_costs = EXCLUDED.food_costs,
      utility_costs = EXCLUDED.utility_costs,
      payroll_costs = EXCLUDED.payroll_costs,
      net_gain = EXCLUDED.net_gain,
      orders_count = EXCLUDED.orders_count,
      computed_at = CURRENT_TIMESTAMP
  `, [companyId, companyToken, date, gross, paymentFees, foodCosts, utilityDailyCost, payrollCosts, netGain, ordersCount])

  return { date, companyToken, gross, paymentFees, foodCosts, utilityCosts: utilityDailyCost, payrollCosts, netGain, ordersCount }
}

// Compute gains for all accounts across all companies for a single date
async function computeAllAccountsForDate(date) {
  const companiesRes = await pool.query('SELECT id, timezone FROM companies')
  let computed = 0

  for (const company of companiesRes.rows) {
    const accountsRes = await pool.query(
      'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1',
      [company.id]
    )

    for (const acc of accountsRes.rows) {
      try {
        await computeAndStoreDailyGain(company.id, acc.company_token, acc.api_token, date, company.timezone || 'America/Lima')
        computed++
      } catch (err) {
        console.error(`  ❌ Failed gain computation for ${acc.company_token} on ${date}:`, err.message)
      }
      // 2s delay between accounts within the same day
      await sleep(2000)
    }
  }

  return computed
}

// Backfill gains for a date range (all companies or a specific one)
// Throttled to ~1 day per minute to avoid OlaClick API rate limits
export async function backfillGains(startDate, endDate, companyId = null) {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1

  console.log(`📊 Backfill: ${startDate} → ${endDate} (${totalDays} days)`)

  let dayIndex = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dayIndex++
    const dateStr = d.toISOString().split('T')[0]

    if (companyId) {
      // Backfill for specific company
      const company = (await pool.query('SELECT id, timezone FROM companies WHERE id = $1', [companyId])).rows[0]
      if (!company) continue
      const accounts = (await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [companyId])).rows
      const names = []
      for (const acc of accounts) {
        try {
          await computeAndStoreDailyGain(company.id, acc.company_token, acc.api_token, dateStr, company.timezone || 'America/Lima')
          names.push(acc.company_token)
        } catch (err) {
          names.push(`${acc.company_token} ✗`)
          console.error(`  ❌ Backfill error ${acc.company_token} ${dateStr}:`, err.message)
        }
        await sleep(2000)
      }
      console.log(`📊 Backfill [${dayIndex}/${totalDays}] ${dateStr} — ${names.join(' ')}`)
    } else {
      // Backfill all companies
      const count = await computeAllAccountsForDate(dateStr)
      console.log(`📊 Backfill [${dayIndex}/${totalDays}] ${dateStr} — ${count} accounts computed`)
    }

    // ~60s between days to stay well under rate limits
    if (dayIndex < totalDays) {
      await sleep(60000)
    }
  }

  console.log(`📊 Backfill complete: ${totalDays} days processed`)
  return totalDays
}

// Auto-backfill on startup if table is empty — covers all of 2026 through yesterday
export async function autoBackfillIfNeeded() {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM daily_gains')
    const count = parseInt(countRes.rows[0].count, 10)

    if (count > 0) {
      console.log(`📊 Daily gains table has ${count} rows, skipping auto-backfill`)
      return
    }

    // Table is empty — backfill from 2026-01-01 to yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const endDate = yesterday.toISOString().split('T')[0]
    const startDate = '2026-01-01'

    if (endDate < startDate) {
      console.log('📊 No dates to backfill')
      return
    }

    console.log(`📊 Auto-backfill triggered: ${startDate} → ${endDate}`)
    // Run in background — don't await
    backfillGains(startDate, endDate).catch(err => {
      console.error('❌ Auto-backfill error:', err.message)
    })
  } catch (err) {
    // Table might not exist yet if migration hasn't run
    console.log('📊 Daily gains table not ready, skipping auto-backfill')
  }
}

// Schedule cron jobs for daily gain computation
export function scheduleDailyGainsCron() {
  // 3 AM Lima time — compute yesterday's final gain
  cron.schedule('0 3 * * *', async () => {
    console.log('📊 [Cron] Computing yesterday\'s daily gains...')
    try {
      const companiesRes = await pool.query('SELECT id, timezone FROM companies')
      for (const company of companiesRes.rows) {
        const tz = company.timezone || 'America/Lima'
        const yesterday = getYesterdayInTimezone(tz)
        const accounts = (await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [company.id])).rows
        for (const acc of accounts) {
          try {
            await computeAndStoreDailyGain(company.id, acc.company_token, acc.api_token, yesterday, tz)
            console.log(`  ✓ ${acc.company_token} ${yesterday}`)
          } catch (err) {
            console.error(`  ❌ ${acc.company_token} ${yesterday}:`, err.message)
          }
          await sleep(2000)
        }
      }
      console.log('📊 [Cron] Yesterday\'s gains computed')
    } catch (err) {
      console.error('❌ [Cron] Daily gains error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  // Every 2 hours from 8 AM to 11 PM Lima time — update today's rolling snapshot
  cron.schedule('0 8-23/2 * * *', async () => {
    console.log('📊 [Cron] Updating today\'s daily gains...')
    try {
      const companiesRes = await pool.query('SELECT id, timezone FROM companies')
      for (const company of companiesRes.rows) {
        const tz = company.timezone || 'America/Lima'
        const today = getTimezoneAwareDate(null, tz)
        const accounts = (await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [company.id])).rows
        for (const acc of accounts) {
          try {
            await computeAndStoreDailyGain(company.id, acc.company_token, acc.api_token, today, tz)
          } catch (err) {
            console.error(`  ❌ ${acc.company_token} ${today}:`, err.message)
          }
          await sleep(2000)
        }
      }
      console.log('📊 [Cron] Today\'s gains updated')
    } catch (err) {
      console.error('❌ [Cron] Today gains error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  console.log('📊 Daily gains cron jobs scheduled (3 AM final + every 2h rolling)')
}

// Helper: get yesterday's date in a timezone
function getYesterdayInTimezone(timezone) {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const todayDate = new Date(todayStr + 'T12:00:00')
  todayDate.setDate(todayDate.getDate() - 1)
  return todayDate.toISOString().split('T')[0]
}
