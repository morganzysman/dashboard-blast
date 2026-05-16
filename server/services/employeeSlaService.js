import cron from 'node-cron'
import { pool } from '../database.js'
import {
  fetchOrdersList,
  getOrderId,
  getKitchenChannelKey,
  getOrderServiceType,
  isPrepStampLikelyMissing
} from './olaClickService.js'
import {
  fetchKitchenSlaTargetsByTokens,
  resolveKitchenTargetMinutes
} from './kitchenSlaService.js'

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDateInTimezone(isoOrDate, timeZone) {
  if (!isoOrDate) return null
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(isoOrDate))
  } catch {
    return new Date(isoOrDate).toISOString().slice(0, 10)
  }
}

function getYesterdayInTimezone(timezone) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const todayDate = new Date(todayStr + 'T12:00:00')
  todayDate.setDate(todayDate.getDate() - 1)
  return todayDate.toISOString().split('T')[0]
}

function getTodayInTimezone(timezone) {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * Same prep-minutes computation as `olaClickService.kitchenPrepMinutes`, copied here so we
 * don't have to export the private one (and so we can keep the SLA-specific filter local).
 * @param {Record<string, any>} order
 */
function prepMinutes(order) {
  if (!order?.preparing_at || !order?.prepared_at || order?.status === 'CANCELLED') return null
  if (isPrepStampLikelyMissing(order)) return null
  const a = new Date(order.preparing_at).getTime()
  const b = new Date(order.prepared_at).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, (b - a) / 60_000)
}

/* -------------------------------------------------------------------------- */
/* core compute                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Recompute the per-cook kitchen-SLA slice for one (account, date). This:
 *   1. fetches the day's orders from OlaClick
 *   2. for each prepped order, looks up which `users.job_type='kitchen'` employees were
 *      clocked-in at `prepared_at`
 *   3. wipes prior rows for that (company_token, day_local) pair from
 *      `employee_kitchen_sla_orders` and re-inserts (idempotent)
 *   4. rebuilds the matching `employee_kitchen_sla_daily` rollup rows
 *
 * @param {string} companyId
 * @param {{company_token:string, api_token:string}} account
 * @param {string} date YYYY-MM-DD in `timezone`
 * @param {string} timezone IANA tz, e.g. 'America/Lima'
 */
export async function computeAndStoreEmployeeSlaForDay(companyId, account, date, timezone) {
  const companyToken = account.company_token
  if (!companyToken) return { ordersWithPrep: 0, attributions: 0 }

  // 1. Fetch orders for the day
  let orders = []
  try {
    orders = await fetchOrdersList(account, { startDate: date, endDate: date, timezone })
  } catch (err) {
    console.error(`  ❌ employeeSla fetchOrdersList ${companyToken} ${date}:`, err.message)
    return { ordersWithPrep: 0, attributions: 0, error: err.message }
  }

  // 2. Resolve SLA targets for this account
  const slaMap = await fetchKitchenSlaTargetsByTokens([companyToken])
  const targets = slaMap.get(companyToken) || {}

  // 3. Build attributions
  const attributions = [] // rows for employee_kitchen_sla_orders
  let withPrep = 0

  for (const order of orders) {
    const mins = prepMinutes(order)
    if (mins == null) continue
    withPrep += 1

    const orderId = getOrderId(order)
    if (!orderId) continue

    const channelKey = getKitchenChannelKey(order)
    const serviceType = getOrderServiceType(order)
    const target = resolveKitchenTargetMinutes(channelKey, targets)
    const onTime = mins <= target
    const preparedAt = order.prepared_at
    const dayLocal = formatDateInTimezone(preparedAt, timezone) || date

    // Find clocked-in cooks at preparedAt
    const cookRows = await pool.query(
      `SELECT te.user_id
         FROM time_entries te
         JOIN users u ON u.id = te.user_id
        WHERE te.company_token = $1
          AND u.job_type = 'kitchen'
          AND te.clock_in_at <= $2::timestamptz
          AND (te.clock_out_at IS NULL OR te.clock_out_at >= $2::timestamptz)`,
      [companyToken, preparedAt]
    )
    const cookCount = cookRows.rows.length
    if (cookCount === 0) continue

    for (const row of cookRows.rows) {
      attributions.push({
        userId: row.user_id,
        companyToken,
        orderId,
        preparedAt,
        prepMinutes: mins,
        targetMinutes: target,
        onTime,
        channelKey,
        serviceType,
        dayLocal,
        cookCount
      })
    }
  }

  // 4. Persist atomically: delete the day's slice for this account, re-insert, rebuild daily roll-up
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Delete prior orders for this (account, day_local) — covers users that had attribution
    // yesterday but no longer do (e.g. unflagged cook).
    await client.query(
      `DELETE FROM employee_kitchen_sla_orders
        WHERE company_token = $1 AND day_local = $2`,
      [companyToken, date]
    )

    if (attributions.length > 0) {
      // Bulk insert
      const values = []
      const params = []
      let p = 1
      for (const a of attributions) {
        values.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`
        )
        params.push(
          a.userId,
          a.companyToken,
          a.orderId,
          a.preparedAt,
          a.prepMinutes,
          a.targetMinutes,
          a.onTime,
          a.channelKey,
          a.serviceType,
          a.dayLocal,
          a.cookCount
        )
      }
      await client.query(
        `INSERT INTO employee_kitchen_sla_orders
           (user_id, company_token, order_id, prepared_at, prep_minutes, target_minutes,
            on_time, channel_key, service_type, day_local, cook_count)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, company_token, order_id) DO UPDATE SET
           prepared_at    = EXCLUDED.prepared_at,
           prep_minutes   = EXCLUDED.prep_minutes,
           target_minutes = EXCLUDED.target_minutes,
           on_time        = EXCLUDED.on_time,
           channel_key    = EXCLUDED.channel_key,
           service_type   = EXCLUDED.service_type,
           day_local      = EXCLUDED.day_local,
           cook_count     = EXCLUDED.cook_count,
           computed_at    = NOW()`,
        params
      )
    }

    // Rebuild daily rollup rows for this (account, day): wipe matching rows then insert from orders
    await client.query(
      `DELETE FROM employee_kitchen_sla_daily
        WHERE company_token = $1 AND day_local = $2`,
      [companyToken, date]
    )

    await client.query(
      `INSERT INTO employee_kitchen_sla_daily
         (user_id, company_token, day_local, orders_count, on_time_count, late_count,
          avg_prep_minutes, total_prep_minutes, computed_at)
       SELECT
         user_id,
         company_token,
         day_local,
         COUNT(*)::int                                       AS orders_count,
         COUNT(*) FILTER (WHERE on_time)::int                AS on_time_count,
         COUNT(*) FILTER (WHERE NOT on_time)::int            AS late_count,
         ROUND(AVG(prep_minutes)::numeric, 2)                AS avg_prep_minutes,
         ROUND(SUM(prep_minutes)::numeric, 2)                AS total_prep_minutes,
         NOW()
       FROM employee_kitchen_sla_orders
       WHERE company_token = $1 AND day_local = $2
       GROUP BY user_id, company_token, day_local`,
      [companyToken, date]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }

  return { ordersWithPrep: withPrep, attributions: attributions.length }
}

/* -------------------------------------------------------------------------- */
/* sweep / cron                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Compute employee SLA for every account in every company on `date`.
 * @param {string} date YYYY-MM-DD (will be interpreted in each company's timezone)
 */
async function computeAllAccountsForDate(date) {
  const companies = (await pool.query('SELECT id, timezone FROM companies')).rows
  let total = 0
  for (const company of companies) {
    const tz = company.timezone || 'America/Lima'
    const accounts = (
      await pool.query(
        'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1',
        [company.id]
      )
    ).rows
    for (const account of accounts) {
      try {
        const r = await computeAndStoreEmployeeSlaForDay(company.id, account, date, tz)
        total += r.attributions || 0
      } catch (err) {
        console.error(
          `  ❌ employeeSla failed ${account.company_token} ${date}:`,
          err.message
        )
      }
      await sleep(2000) // throttle OlaClick
    }
  }
  return total
}

/**
 * Backfill a date range. Throttled ~1 day / 60s like daily-gains.
 */
export async function backfillEmployeeSla(startDate, endDate) {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24)) + 1
  console.log(`👨‍🍳 Employee-SLA backfill: ${startDate} → ${endDate} (${totalDays} days)`)
  let i = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    i += 1
    const dateStr = d.toISOString().split('T')[0]
    try {
      const n = await computeAllAccountsForDate(dateStr)
      console.log(`👨‍🍳 [${i}/${totalDays}] ${dateStr} — ${n} attributions`)
    } catch (err) {
      console.error(`👨‍🍳 [${i}/${totalDays}] ${dateStr} — ERROR: ${err.message}`)
    }
    if (i < totalDays) await sleep(60_000)
  }
  console.log(`👨‍🍳 Employee-SLA backfill complete (${totalDays} days)`)
  return totalDays
}

/**
 * Auto-backfill on startup. Looks for missing day_local rows in employee_kitchen_sla_daily
 * between 2026-01-01 and yesterday (per-company timezone) and fills them in the background.
 */
export async function autoBackfillEmployeeSlaIfNeeded() {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const endDate = yesterday.toISOString().split('T')[0]
    const startDate = '2026-01-01'
    if (endDate < startDate) {
      console.log('👨‍🍳 Employee-SLA: no dates to backfill')
      return
    }

    const existing = await pool.query(
      `SELECT DISTINCT to_char(day_local, 'YYYY-MM-DD') AS d
         FROM employee_kitchen_sla_daily
        WHERE day_local >= $1 AND day_local <= $2`,
      [startDate, endDate]
    )
    const have = new Set(existing.rows.map((r) => r.d))

    const missing = []
    const cur = new Date(startDate + 'T12:00:00')
    const endObj = new Date(endDate + 'T12:00:00')
    while (cur <= endObj) {
      const s = cur.toISOString().split('T')[0]
      if (!have.has(s)) missing.push(s)
      cur.setDate(cur.getDate() + 1)
    }

    if (missing.length === 0) {
      console.log(
        `👨‍🍳 Employee-SLA: no missing dates (${have.size} already computed)`
      )
      return
    }

    console.log(
      `👨‍🍳 Employee-SLA auto-backfill: ${missing.length} missing dates (${missing[0]} → ${missing[missing.length - 1]})`
    )

    // Run in background — don't await
    ;(async () => {
      for (let i = 0; i < missing.length; i++) {
        const d = missing[i]
        try {
          const n = await computeAllAccountsForDate(d)
          console.log(`👨‍🍳 backfill [${i + 1}/${missing.length}] ${d} — ${n} attributions`)
        } catch (err) {
          console.error(`👨‍🍳 backfill [${i + 1}/${missing.length}] ${d} — ERROR: ${err.message}`)
        }
        if (i < missing.length - 1) await sleep(60_000)
      }
      console.log(`👨‍🍳 Employee-SLA backfill complete: ${missing.length} dates`)
    })().catch((err) => console.error('❌ Employee-SLA auto-backfill error:', err.message))
  } catch (err) {
    console.log('👨‍🍳 Employee-SLA tables not ready, skipping auto-backfill:', err.message)
  }
}

/**
 * Cron schedule: 3:30 AM final pass on yesterday + every 2 hours rolling pass on today.
 * Offset 30 minutes from daily-gains so they don't both hammer OlaClick at once.
 */
export function scheduleEmployeeSlaCron() {
  cron.schedule(
    '30 3 * * *',
    async () => {
      console.log("👨‍🍳 [Cron] Computing yesterday's employee-SLA…")
      try {
        const companies = (await pool.query('SELECT id, timezone FROM companies')).rows
        for (const company of companies) {
          const tz = company.timezone || 'America/Lima'
          const yesterday = getYesterdayInTimezone(tz)
          const accounts = (
            await pool.query(
              'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1',
              [company.id]
            )
          ).rows
          for (const account of accounts) {
            try {
              await computeAndStoreEmployeeSlaForDay(company.id, account, yesterday, tz)
              console.log(`  ✓ employeeSla ${account.company_token} ${yesterday}`)
            } catch (err) {
              console.error(`  ❌ employeeSla ${account.company_token} ${yesterday}:`, err.message)
            }
            await sleep(2000)
          }
        }
        console.log("👨‍🍳 [Cron] Employee-SLA: yesterday's pass complete")
      } catch (err) {
        console.error('❌ [Cron] Employee-SLA yesterday error:', err.message)
      }
    },
    { timezone: 'America/Lima' }
  )

  cron.schedule(
    '15 9-23/2 * * *',
    async () => {
      console.log("👨‍🍳 [Cron] Updating today's employee-SLA…")
      try {
        const companies = (await pool.query('SELECT id, timezone FROM companies')).rows
        for (const company of companies) {
          const tz = company.timezone || 'America/Lima'
          const today = getTodayInTimezone(tz)
          const accounts = (
            await pool.query(
              'SELECT company_token, api_token FROM company_accounts WHERE company_id = $1',
              [company.id]
            )
          ).rows
          for (const account of accounts) {
            try {
              await computeAndStoreEmployeeSlaForDay(company.id, account, today, tz)
            } catch (err) {
              console.error(`  ❌ employeeSla ${account.company_token} ${today}:`, err.message)
            }
            await sleep(2000)
          }
        }
        console.log("👨‍🍳 [Cron] Employee-SLA: today's pass complete")
      } catch (err) {
        console.error('❌ [Cron] Employee-SLA today error:', err.message)
      }
    },
    { timezone: 'America/Lima' }
  )

  console.log('👨‍🍳 Employee-SLA cron jobs scheduled (3:30 AM final + every 2h rolling)')
}
