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
  //
  // Two parallel rollups are produced in the same loop so the per-account
  // matrix and the per-cook leaderboard always agree on the underlying orders:
  //   - `attributions` => rows for employee_kitchen_sla_orders (per-cook).
  //     Only populated for orders where at least one job_type='kitchen' user
  //     was clocked-in at `prepared_at`.
  //   - `accountChannelMap` => rows for account_kitchen_sla_daily (per
  //     account x channel). Populated for every prepped order, even if no
  //     cook was tagged. Without this, the matrix would silently undercount
  //     volume whenever the cook tagging is incomplete.
  const attributions = []
  /** @type {Map<string, {ordersCount:number, onTimeCount:number, lateCount:number, totalPrepMinutes:number, targetMinutes:number, unreliablePrepCount:number}>} */
  const accountChannelMap = new Map()
  let withPrep = 0

  // First pass: count "unreliable prep" orders per channel. These are orders
  // the SLA pipeline tried to evaluate (prepared_at + a close stamp set) but
  // dropped because prepared_at sits within 60s of the close — i.e. the
  // waiter likely didn't mark prep and OlaClick stamped it on auto-close.
  // We track this so the UI can show "SLA coverage" — what % of evaluated
  // orders actually counted. The denominator for coverage is
  //   orders_count + unreliable_prep_count
  // because together they represent every order we *attempted* to score.
  for (const order of orders) {
    if (!order?.prepared_at) continue
    const hasCloseStamp = !!(order.closed_at || order.finished_at || order.completed_at)
    if (!hasCloseStamp) continue
    if (!isPrepStampLikelyMissing(order)) continue
    const channelKey = getKitchenChannelKey(order)
    const target = resolveKitchenTargetMinutes(channelKey, targets)
    const acc = accountChannelMap.get(channelKey) || {
      ordersCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalPrepMinutes: 0,
      targetMinutes: target,
      unreliablePrepCount: 0
    }
    acc.unreliablePrepCount += 1
    // Hold onto the target so channels that have ONLY unreliable orders still
    // persist with a sensible target_minutes (NOT NULL column).
    if (!acc.targetMinutes) acc.targetMinutes = target
    accountChannelMap.set(channelKey, acc)
  }

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

    // Always update the per-account-per-channel bucket first (this is the
    // ground-truth view; cook attribution, if any, gets layered on top).
    const acc = accountChannelMap.get(channelKey) || {
      ordersCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalPrepMinutes: 0,
      targetMinutes: target,
      unreliablePrepCount: 0
    }
    acc.ordersCount += 1
    acc.totalPrepMinutes += mins
    if (onTime) acc.onTimeCount += 1
    else acc.lateCount += 1
    accountChannelMap.set(channelKey, acc)

    // Per-cook attribution (subset). Skip when no kitchen user was clocked-in.
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

    // Rebuild per-account-per-channel rollup for this (account, day) too. We
    // wipe-and-insert from `accountChannelMap` (not from
    // employee_kitchen_sla_orders) because the latter excludes orders without
    // tagged cooks; the matrix needs the complete ground truth.
    await client.query(
      `DELETE FROM account_kitchen_sla_daily
        WHERE company_token = $1 AND day_local = $2`,
      [companyToken, date]
    )

    if (accountChannelMap.size > 0) {
      const accValues = []
      const accParams = []
      let q = 1
      for (const [channelKey, b] of accountChannelMap) {
        const avg = b.ordersCount > 0 ? b.totalPrepMinutes / b.ordersCount : 0
        accValues.push(
          `($${q++}, $${q++}, $${q++}, $${q++}, $${q++}, $${q++}, $${q++}, $${q++}, $${q++}, $${q++})`
        )
        accParams.push(
          companyToken,
          date,
          channelKey,
          b.ordersCount,
          b.onTimeCount,
          b.lateCount,
          Number(b.totalPrepMinutes.toFixed(2)),
          Number(avg.toFixed(2)),
          b.targetMinutes,
          b.unreliablePrepCount || 0
        )
      }
      await client.query(
        `INSERT INTO account_kitchen_sla_daily
           (company_token, day_local, channel_key, orders_count, on_time_count,
            late_count, total_prep_minutes, avg_prep_minutes, target_minutes,
            unreliable_prep_count)
         VALUES ${accValues.join(', ')}`,
        accParams
      )
    }

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

// Process-lifetime flag so the 14-day coverage recompute (see below) runs at
// most once per server boot, even if `autoBackfillEmployeeSlaIfNeeded` is
// invoked again later. We deliberately do NOT persist this flag — the goal
// is "every fresh process catches the latest 14 days up", not full idempotency.
let coverageRecomputeRanThisProcess = false

/**
 * Auto-backfill on startup. Looks for missing day_local rows in employee_kitchen_sla_daily
 * between 2026-01-01 and yesterday (per-company timezone) and fills them in the background.
 *
 * Additionally, on the first invocation per process we always recompute the
 * last 14 days (regardless of whether rows already exist for those days). This
 * is the one-shot data fix that populates the new `unreliable_prep_count`
 * column for the SLA-coverage rollout: existing rows default to 0, and
 * recomputing pulls the real value off the source orders.
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

    // Use account_kitchen_sla_daily as the freshness signal: it carries a row
    // for every day that had at least one prepped order, regardless of cook
    // tagging coverage. employee_kitchen_sla_daily would mark days as missing
    // whenever no kitchen user happened to be clocked-in.
    const existing = await pool.query(
      `SELECT DISTINCT to_char(day_local, 'YYYY-MM-DD') AS d
         FROM account_kitchen_sla_daily
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

    // Always force-recompute the last 14 days the first time we run in this
    // process. This catches up the new coverage column on rows that pre-date
    // migration 048 without requiring a manual backfill command.
    const recomputeWindow = []
    if (!coverageRecomputeRanThisProcess) {
      coverageRecomputeRanThisProcess = true
      const start = new Date(endDate + 'T12:00:00')
      start.setDate(start.getDate() - 13) // 14 days inclusive
      const cur2 = new Date(start)
      while (cur2 <= endObj) {
        recomputeWindow.push(cur2.toISOString().split('T')[0])
        cur2.setDate(cur2.getDate() + 1)
      }
      console.log(
        `👨‍🍳 [employee-sla] Recomputing last 14 days to populate coverage denominators (${recomputeWindow[0]} → ${recomputeWindow[recomputeWindow.length - 1]})…`
      )
    }

    // Merge: anything missing OR in the forced recompute window. De-dup and
    // sort so we walk dates in order.
    const todoSet = new Set([...missing, ...recomputeWindow])
    const todo = [...todoSet].sort()

    if (todo.length === 0) {
      console.log(
        `👨‍🍳 Employee-SLA: no missing dates (${have.size} already computed)`
      )
      return
    }

    console.log(
      `👨‍🍳 Employee-SLA auto-backfill: ${todo.length} dates queued (${todo[0]} → ${todo[todo.length - 1]}; ${missing.length} missing + ${recomputeWindow.length} forced recompute)`
    )

    // Run in background — don't await
    ;(async () => {
      for (let i = 0; i < todo.length; i++) {
        const d = todo[i]
        try {
          const n = await computeAllAccountsForDate(d)
          console.log(`👨‍🍳 backfill [${i + 1}/${todo.length}] ${d} — ${n} attributions`)
        } catch (err) {
          console.error(`👨‍🍳 backfill [${i + 1}/${todo.length}] ${d} — ERROR: ${err.message}`)
        }
        if (i < todo.length - 1) await sleep(60_000)
      }
      console.log(`👨‍🍳 Employee-SLA backfill complete: ${todo.length} dates`)
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
