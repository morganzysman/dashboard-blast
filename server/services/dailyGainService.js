import cron from 'node-cron'
import { pool } from '../database.js'
import { fetchOlaClickData, fetchOrdersList, getTimezoneAwareDate } from './olaClickService.js'

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

  // Fetch revenue from OlaClick's /by_payment_methods aggregator. This endpoint
  // returns one row per payment method, so `sum` correctly aggregates revenue
  // across split payments. It is NOT a valid source for distinct order count —
  // a single order paid with cash + Yape would appear in both method rows, so
  // summing `count` double-counts split-payment orders. We keep `methods` here
  // for the payment-fees loop below and derive `ordersCount` from the /orders
  // list (see next block).
  let gross = 0
  let methods = []
  try {
    const result = await fetchOlaClickData(account, filterParams)
    if (result.success && result.data?.data) {
      methods = result.data.data
      gross = methods.reduce((s, m) => s + (Number(m.sum) || 0), 0)
    }
  } catch (err) {
    console.error(`  ❌ OlaClick API error for ${companyToken} on ${date}:`, err.message)
    return null
  }

  // Distinct-order count from the /orders list endpoint — same source the
  // dashboard's "Daily ORDERS" card uses (via `meta.total`). We filter out
  // CANCELLED to preserve the calendar's existing semantics: the
  // `by_payment_methods` aggregator used above for `gross` also excludes
  // CANCELLED by default (see fetchOlaClickData's default status filter), and
  // the dashboard's status-filter difference (it INCLUDES cancelled) is
  // intentional and out of scope for this fix.
  let ordersCount = 0
  try {
    const orders = await fetchOrdersList(account, {
      startDate: date,
      endDate: date,
      timezone
    })
    ordersCount = orders.filter((o) => {
      const status = (o?.status || '').toString().toUpperCase()
      return status !== 'CANCELLED'
    }).length
  } catch (err) {
    console.error(`  ❌ OlaClick /orders fetch error for ${companyToken} on ${date}:`, err.message)
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

// Auto-backfill on startup — heal missing AND stale (account, day) rows from
// 2026-01-01 through yesterday.
//
// This is per-ACCOUNT, not per-date, on purpose. `computeAndStoreDailyGain`
// skips writing a row when the OlaClick fetch for that account fails, so a
// single transient error leaves a permanent hole for just that account on that
// day. A per-date check ("does any account have a row for this date?") can't
// see those holes — it treats the date as done as long as one account
// succeeded.
//
// Two failure modes both corrupt an account's same-weekday "record to beat":
//   • MISSING — no row at all (fetch failed and never retried).
//   • STALE   — a row exists but is only an intraday snapshot that never got
//               finalized after the day closed (nightly cron missed / failed
//               that night). The frozen partial value undercounts the day, so
//               a genuine best-Saturday can be hidden behind an older one.
//
// We detect a stale row as: a past day (in the company timezone) whose
// computed_at (in that timezone) lands on or before the day itself. We only
// fill INTERIOR gaps: for each account we start from its earliest existing row
// and fill any missing day up to yesterday. Accounts with no rows at all in the
// window are skipped so we never fabricate zero-revenue rows for dates before
// the account existed.
export async function autoBackfillIfNeeded() {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const endDate = yesterday.toISOString().split('T')[0]
    const startDate = '2026-01-01'

    if (endDate < startDate) {
      console.log('📊 No dates to backfill')
      return
    }

    // Accounts we can recompute (need api_token) plus their company timezone.
    const accountsRes = await pool.query(`
      SELECT ca.company_id, ca.company_token, ca.api_token, c.timezone
      FROM company_accounts ca
      JOIN companies c ON c.id = ca.company_id
    `)
    if (accountsRes.rows.length === 0) {
      console.log('📊 No accounts configured, skipping auto-backfill')
      return
    }

    // Map accounts by key for quick api_token / timezone lookup.
    const accMap = new Map()
    for (const acc of accountsRes.rows) {
      accMap.set(`${acc.company_id}|${acc.company_token}`, acc)
    }

    // Existing (company_id, company_token, date) rows in the window, flagged
    // stale when they're a past day whose last compute (in the company tz)
    // happened on or before that same day — i.e. a partial intraday snapshot
    // that never got finalized.
    const existingRes = await pool.query(
      `SELECT dg.company_id,
              dg.company_token,
              to_char(dg.date, 'YYYY-MM-DD') AS date_str,
              (dg.date < (now() AT TIME ZONE c.timezone)::date
               AND (dg.computed_at AT TIME ZONE c.timezone)::date <= dg.date) AS is_stale
       FROM daily_gains dg
       JOIN companies c ON c.id = dg.company_id
       WHERE dg.date >= $1 AND dg.date <= $2`,
      [startDate, endDate]
    )
    // Fresh database (no rows yet): fall back to the original full-history
    // initialization so a first deploy still populates every day/account.
    if (existingRes.rows.length === 0) {
      const dates = []
      const current = new Date(startDate + 'T12:00:00')
      const endObj = new Date(endDate + 'T12:00:00')
      while (current <= endObj) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
      console.log(`📊 Auto-backfill: empty daily_gains — initializing ${dates.length} days for all accounts`)
      backfillAllAccountsForDates(dates).catch(err => {
        console.error('❌ Auto-backfill error:', err.message)
      })
      return
    }

    const existingByAccount = new Map() // key `${companyId}|${token}` -> Set(dateStr)
    const todo = new Map() // dedupe key `${companyId}|${token}|${date}` -> tuple
    let staleCount = 0

    const addTuple = (companyId, companyToken, date) => {
      const acc = accMap.get(`${companyId}|${companyToken}`)
      if (!acc) return // account removed / no api_token — can't recompute
      todo.set(`${companyId}|${companyToken}|${date}`, {
        companyId,
        companyToken,
        apiToken: acc.api_token,
        timezone: acc.timezone || 'America/Lima',
        date
      })
    }

    for (const row of existingRes.rows) {
      const key = `${row.company_id}|${row.company_token}`
      if (!existingByAccount.has(key)) existingByAccount.set(key, new Set())
      existingByAccount.get(key).add(row.date_str)
      // Stale rows (partial intraday snapshots) get re-finalized.
      if (row.is_stale) {
        staleCount += 1
        addTuple(row.company_id, row.company_token, row.date_str)
      }
    }

    // Add interior missing (account, day) gaps.
    let missingCount = 0
    for (const acc of accountsRes.rows) {
      const key = `${acc.company_id}|${acc.company_token}`
      const dates = existingByAccount.get(key)
      // No history for this account in the window — don't backfill pre-existence
      // dates; the crons will start populating it from today/yesterday onward.
      if (!dates || dates.size === 0) continue

      const accountStart = [...dates].sort()[0]
      const current = new Date(accountStart + 'T12:00:00')
      const endObj = new Date(endDate + 'T12:00:00')
      while (current <= endObj) {
        const dateStr = current.toISOString().split('T')[0]
        if (!dates.has(dateStr)) {
          missingCount += 1
          addTuple(acc.company_id, acc.company_token, dateStr)
        }
        current.setDate(current.getDate() + 1)
      }
    }

    const tuples = [...todo.values()]
    if (tuples.length === 0) {
      console.log(`📊 No account-days to backfill (${existingRes.rows.length} rows already exist)`)
      return
    }

    console.log(`📊 Auto-backfill: ${tuples.length} account-days to recompute (${missingCount} missing, ${staleCount} stale; ${existingRes.rows.length} rows exist)`)

    // Run in background — don't await
    backfillAccountDays(tuples).catch(err => {
      console.error('❌ Auto-backfill error:', err.message)
    })
  } catch (err) {
    // Table might not exist yet if migration hasn't run
    console.log('📊 Daily gains table not ready, skipping auto-backfill')
  }
}

// Full initialization path (fresh DB): compute every account for each date,
// throttled ~1 day/min to stay under OlaClick rate limits.
async function backfillAllAccountsForDates(dates) {
  console.log(`📊 Backfilling ${dates.length} dates (all accounts)...`)

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]
    try {
      const count = await computeAllAccountsForDate(dateStr)
      console.log(`📊 Backfill [${i + 1}/${dates.length}] ${dateStr} — ${count} accounts computed`)
    } catch (err) {
      console.error(`📊 Backfill [${i + 1}/${dates.length}] ${dateStr} — ERROR: ${err.message}`)
    }

    // ~60s between days to stay well under rate limits
    if (i < dates.length - 1) {
      await sleep(60000)
    }
  }

  console.log(`📊 Backfill complete: ${dates.length} dates processed`)
}

// Recompute specific (account, day) tuples — missing or stale (throttled to
// avoid OlaClick rate limits). Unlike the per-date backfill, this only
// re-fetches the exact account+day holes, so cost scales with the number of
// gaps/stale rows rather than the number of calendar days.
async function backfillAccountDays(tuples) {
  console.log(`📊 Backfilling ${tuples.length} account-days...`)

  for (let i = 0; i < tuples.length; i++) {
    const t = tuples[i]
    try {
      const result = await computeAndStoreDailyGain(t.companyId, t.companyToken, t.apiToken, t.date, t.timezone)
      const status = result ? `gross=${(result.gross ?? 0).toFixed(2)}` : 'SKIPPED (no OlaClick data)'
      console.log(`📊 Backfill [${i + 1}/${tuples.length}] ${t.companyToken} ${t.date} — ${status}`)
    } catch (err) {
      console.error(`📊 Backfill [${i + 1}/${tuples.length}] ${t.companyToken} ${t.date} — ERROR: ${err.message}`)
    }

    // 2s between calls to stay well under rate limits
    if (i < tuples.length - 1) {
      await sleep(2000)
    }
  }

  console.log(`📊 Backfill complete: ${tuples.length} account-days processed`)
}

// Number of trailing days the nightly cron re-finalizes. Recomputing more than
// just "yesterday" means a single missed/failed nightly run (deploy, outage,
// transient OlaClick error) self-heals on a later night instead of leaving a
// permanently stale partial-day snapshot that corrupts the same-weekday record.
const NIGHTLY_FINALIZE_DAYS = 3

// Schedule cron jobs for daily gain computation
export function scheduleDailyGainsCron() {
  // 3 AM Lima time — finalize the last few closed days (see NIGHTLY_FINALIZE_DAYS)
  cron.schedule('0 3 * * *', async () => {
    console.log(`📊 [Cron] Finalizing last ${NIGHTLY_FINALIZE_DAYS} day(s) of daily gains...`)
    try {
      const companiesRes = await pool.query('SELECT id, timezone FROM companies')
      for (const company of companiesRes.rows) {
        const tz = company.timezone || 'America/Lima'
        const days = getRecentDatesInTimezone(NIGHTLY_FINALIZE_DAYS, tz) // yesterday, -2, -3, ...
        const accounts = (await pool.query('SELECT company_token, api_token FROM company_accounts WHERE company_id = $1', [company.id])).rows
        for (const day of days) {
          for (const acc of accounts) {
            try {
              await computeAndStoreDailyGain(company.id, acc.company_token, acc.api_token, day, tz)
              console.log(`  ✓ ${acc.company_token} ${day}`)
            } catch (err) {
              console.error(`  ❌ ${acc.company_token} ${day}:`, err.message)
            }
            await sleep(2000)
          }
        }
      }
      console.log('📊 [Cron] Recent days finalized')
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

// Helper: get the last `count` closed days (yesterday, -2, ...) in a timezone,
// ordered oldest → newest.
function getRecentDatesInTimezone(count, timezone) {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const dates = []
  for (let i = count; i >= 1; i--) {
    const d = new Date(todayStr + 'T12:00:00')
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}
