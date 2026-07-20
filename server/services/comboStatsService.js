import cron from 'node-cron'
import { pool } from '../database.js'
import { getTimezoneAwareDate } from './olaClickService.js'
import {
  fetchPublicOrdersList,
  fetchPublicOrderDetail,
  countOrderUnits
} from './publicOlaClickService.js'

// Statuses considered "final and countable" — we only pay for a detail fetch
// (and count combos) once an order reaches one of these. Everything else
// (PENDING/PREPARING/READY) is stored as a skeleton and re-evaluated next run.
// CANCELLED orders are stored as skeletons but excluded from the rollup.
const COUNTABLE_STATUSES = new Set(['FINALIZED', 'DELIVERED'])

// Throttling to stay well under the public API rate limit (~120/window).
const INTER_ORDER_SLEEP_MS = 150
const INTER_ACCOUNT_SLEEP_MS = 1000
const INTER_DAY_SLEEP_MS = 1500

// How many trailing days the nightly cron re-syncs (self-heals a missed night).
const NIGHTLY_FINALIZE_DAYS = 3
// Boot-time backfill window (days back from yesterday). Kept bounded because
// each order costs one detail call; use the admin backfill route for older
// history on demand.
const COMBO_BACKFILL_DAYS = 45

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normStatus(s) {
  return (s || '').toString().toUpperCase().trim()
}

// Sales channel, uppercased. RAPPI / RAPPI_TURBO / WEB / OUTBOUND(=POS).
function normSource(s) {
  const v = (s || '').toString().toUpperCase().trim()
  return v || null
}

function orderTotalOf(order) {
  const v = Number(order?.total ?? order?.total_paid)
  return Number.isFinite(v) ? v : null
}

/**
 * Sync the per-order combo ledger for one account on one local day. Idempotent
 * and resumable:
 *   1. List the day's orders via the public API (order-level skeletons).
 *   2. Load the existing ledger rows for the day.
 *   3. Upsert a skeleton for every listed order.
 *   4. For each countable order not yet fetched (or whose updated_at changed),
 *      fetch detail, count combos, and upsert the full row with fetched_at.
 *
 * A 429/crash mid-run only leaves unfetched gaps; the next run re-lists and
 * fetches just those. Terminal orders already fetched (with unchanged
 * updated_at) are skipped forever.
 *
 * @param {string} companyId
 * @param {string} companyToken
 * @param {string} publicApiKey
 * @param {string} day YYYY-MM-DD (treated as the local business day)
 * @returns {Promise<{listed:number, fetched:number, skipped:number, cancelled:number, errors:number}|null>}
 */
export async function syncComboFactsForDay(companyId, companyToken, publicApiKey, day) {
  if (!publicApiKey) {
    console.warn(`  ⏭️  ${companyToken} ${day}: no public_api_key, skipping combo sync`)
    return null
  }

  let orders
  try {
    orders = await fetchPublicOrdersList(publicApiKey, { startDate: day, endDate: day })
  } catch (err) {
    console.error(`  ❌ Combo list fetch failed for ${companyToken} ${day}: ${err.message}`)
    return null
  }

  // Existing ledger rows for this account+day: order_id -> { fetched, updatedAt }
  const existingRes = await pool.query(
    `SELECT order_id, fetched_at, order_updated_at, burger_units
     FROM combo_order_facts
     WHERE company_token = $1 AND day_local = $2`,
    [companyToken, day]
  )
  const existing = new Map()
  for (const r of existingRes.rows) {
    existing.set(r.order_id, {
      // Treat rows fetched before the burger columns existed as un-fetched so a
      // single pass backfills burger_units; terminal rows are then never re-hit.
      fetched: r.fetched_at != null && r.burger_units != null,
      updatedAt: r.order_updated_at ? new Date(r.order_updated_at).getTime() : null
    })
  }

  let fetched = 0
  let skipped = 0
  let cancelled = 0
  let errors = 0

  for (const order of orders) {
    const orderId = order?.id ?? order?.order_id ?? order?.uuid
    if (!orderId) continue
    const status = normStatus(order.status)
    const source = normSource(order.source)
    const updatedAtMs = order.updated_at ? new Date(order.updated_at).getTime() : null

    // Always keep a skeleton up to date (status/source can change between runs).
    await upsertSkeleton({
      companyId,
      companyToken,
      orderId,
      dayLocal: day,
      status,
      source,
      orderTotal: orderTotalOf(order),
      orderUpdatedAt: order.updated_at || null
    })

    if (status === 'CANCELLED') {
      cancelled += 1
      continue
    }

    if (!COUNTABLE_STATUSES.has(status)) {
      // Not final yet — revisit next run.
      skipped += 1
      continue
    }

    const prev = existing.get(orderId)
    const alreadyFetched =
      prev?.fetched &&
      (prev.updatedAt == null || updatedAtMs == null || prev.updatedAt === updatedAtMs)
    if (alreadyFetched) {
      skipped += 1
      continue
    }

    // Needs a detail fetch to count combos/burgers.
    try {
      const detail = await fetchPublicOrderDetail(publicApiKey, orderId)
      const { comboUnits, comboLines, hasCombo, burgerUnits, burgerLines, hasBurger } =
        countOrderUnits(detail)
      await upsertCounts({
        companyId,
        companyToken,
        orderId,
        dayLocal: day,
        status: normStatus(detail?.status) || status,
        source: normSource(detail?.source) || source,
        orderTotal: orderTotalOf(detail) ?? orderTotalOf(order),
        orderUpdatedAt: detail?.updated_at || order.updated_at || null,
        comboUnits,
        comboLines,
        hasCombo,
        burgerUnits,
        burgerLines,
        hasBurger
      })
      fetched += 1
    } catch (err) {
      errors += 1
      console.error(`  ❌ Combo detail fetch failed for ${companyToken} order ${orderId}: ${err.message}`)
    }

    await sleep(INTER_ORDER_SLEEP_MS)
  }

  console.log(
    `  🍔 Burger sync ${companyToken} ${day}: listed=${orders.length} fetched=${fetched} skipped=${skipped} cancelled=${cancelled} errors=${errors}`
  )
  return { listed: orders.length, fetched, skipped, cancelled, errors }
}

// Skeleton upsert: never touches the combo_* / fetched_at columns so a listing
// pass can't wipe a previously fetched order's counts.
async function upsertSkeleton({ companyId, companyToken, orderId, dayLocal, status, source, orderTotal, orderUpdatedAt }) {
  await pool.query(
    `INSERT INTO combo_order_facts
       (company_id, company_token, order_id, day_local, status, source, order_total, order_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (company_token, order_id) DO UPDATE SET
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       day_local = EXCLUDED.day_local,
       order_total = EXCLUDED.order_total,
       order_updated_at = EXCLUDED.order_updated_at`,
    [companyId, companyToken, orderId, dayLocal, status, source, orderTotal, orderUpdatedAt]
  )
}

// Full upsert after a detail fetch: writes the combo/burger counts and stamps fetched_at.
async function upsertCounts({
  companyId,
  companyToken,
  orderId,
  dayLocal,
  status,
  source,
  orderTotal,
  orderUpdatedAt,
  comboUnits,
  comboLines,
  hasCombo,
  burgerUnits,
  burgerLines,
  hasBurger
}) {
  await pool.query(
    `INSERT INTO combo_order_facts
       (company_id, company_token, order_id, day_local, status, source, order_total, order_updated_at,
        combo_units, combo_lines, has_combo,
        burger_units, burger_lines, has_burger, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
     ON CONFLICT (company_token, order_id) DO UPDATE SET
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       day_local = EXCLUDED.day_local,
       order_total = EXCLUDED.order_total,
       order_updated_at = EXCLUDED.order_updated_at,
       combo_units = EXCLUDED.combo_units,
       combo_lines = EXCLUDED.combo_lines,
       has_combo = EXCLUDED.has_combo,
       burger_units = EXCLUDED.burger_units,
       burger_lines = EXCLUDED.burger_lines,
       has_burger = EXCLUDED.has_burger,
       fetched_at = NOW()`,
    [companyId, companyToken, orderId, dayLocal, status, source, orderTotal, orderUpdatedAt,
     comboUnits, comboLines, hasCombo, burgerUnits, burgerLines, hasBurger]
  )
}

// Load accounts (with a public API key) plus their company timezone.
async function loadComboAccounts(companyId = null) {
  const params = []
  let where = 'ca.public_api_key IS NOT NULL'
  if (companyId) {
    params.push(companyId)
    where += ` AND ca.company_id = $${params.length}`
  }
  const res = await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.public_api_key, c.timezone
     FROM company_accounts ca
     JOIN companies c ON c.id = ca.company_id
     WHERE ${where}
     ORDER BY ca.company_token`,
    params
  )
  return res.rows
}

// Helper: last `count` closed days (yesterday, -2, ...) plus today, in a tz.
function getRecentDatesInTimezone(count, timezone, includeToday = false) {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const dates = []
  const from = includeToday ? 0 : 1
  for (let i = count; i >= from; i--) {
    const d = new Date(todayStr + 'T12:00:00')
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * Backfill combo facts for a date range across accounts (all, or one company).
 * Idempotent/resumable thanks to the ledger. Throttled to respect rate limits.
 *
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string|null} companyId
 */
export async function backfillComboStats(startDate, endDate, companyId = null) {
  const accounts = await loadComboAccounts(companyId)
  if (accounts.length === 0) {
    console.log('🍔 Combo backfill: no accounts with a public_api_key')
    return 0
  }

  const days = []
  const cur = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  console.log(`🍔 Combo backfill: ${accounts.length} account(s) × ${days.length} day(s) (${startDate} → ${endDate})`)
  let processed = 0
  for (const acc of accounts) {
    for (const day of days) {
      try {
        await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
      } catch (err) {
        console.error(`  ❌ Combo backfill error ${acc.company_token} ${day}: ${err.message}`)
      }
      processed += 1
      await sleep(INTER_DAY_SLEEP_MS)
    }
    await sleep(INTER_ACCOUNT_SLEEP_MS)
  }
  console.log(`🍔 Combo backfill complete: ${processed} account-days`)
  return processed
}

/**
 * Boot-time backfill of a bounded recent window, only for accounts that have a
 * public API key. Runs in the background. Cheap on re-run because already-synced
 * terminal orders are skipped.
 */
export async function autoBackfillComboStatsIfNeeded() {
  try {
    const accounts = await loadComboAccounts()
    if (accounts.length === 0) {
      console.log('🍔 No accounts with public_api_key, skipping combo auto-backfill')
      return
    }
    // Use the first account's tz just to compute the window bounds; per-account
    // days are recomputed inside the loop.
    const now = new Date()
    for (const acc of accounts) {
      const tz = acc.timezone || 'America/Lima'
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
      const end = new Date(todayStr + 'T12:00:00')
      end.setDate(end.getDate() - 1) // yesterday
      const start = new Date(todayStr + 'T12:00:00')
      start.setDate(start.getDate() - COMBO_BACKFILL_DAYS)

      const days = []
      const cur = new Date(start)
      while (cur <= end) {
        days.push(cur.toISOString().split('T')[0])
        cur.setDate(cur.getDate() + 1)
      }

      console.log(`🍔 Combo auto-backfill ${acc.company_token}: ${days.length} day(s)`)
      for (const day of days) {
        try {
          await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
        } catch (err) {
          console.error(`  ❌ Combo auto-backfill error ${acc.company_token} ${day}: ${err.message}`)
        }
        await sleep(INTER_DAY_SLEEP_MS)
      }
      await sleep(INTER_ACCOUNT_SLEEP_MS)
    }
    console.log('🍔 Combo auto-backfill complete')
  } catch (err) {
    console.log('🍔 combo_order_facts not ready, skipping combo auto-backfill:', err.message)
  }
}

/** Schedule combo-stats cron jobs (nightly finalize + rolling today). */
export function scheduleComboStatsCron() {
  // 3:30 AM Lima — finalize the last few closed days.
  cron.schedule('30 3 * * *', async () => {
    console.log(`🍔 [Cron] Finalizing last ${NIGHTLY_FINALIZE_DAYS} day(s) of combo stats...`)
    try {
      const accounts = await loadComboAccounts()
      for (const acc of accounts) {
        const tz = acc.timezone || 'America/Lima'
        const days = getRecentDatesInTimezone(NIGHTLY_FINALIZE_DAYS, tz) // yesterday..-N
        for (const day of days) {
          try {
            await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
          } catch (err) {
            console.error(`  ❌ ${acc.company_token} ${day}: ${err.message}`)
          }
          await sleep(INTER_DAY_SLEEP_MS)
        }
        await sleep(INTER_ACCOUNT_SLEEP_MS)
      }
      console.log('🍔 [Cron] Combo stats finalized')
    } catch (err) {
      console.error('❌ [Cron] Combo stats nightly error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  // Every 2 hours from 9 AM to 11 PM Lima — refresh today's rolling snapshot.
  cron.schedule('0 9-23/2 * * *', async () => {
    console.log("🍔 [Cron] Updating today's combo stats...")
    try {
      const accounts = await loadComboAccounts()
      for (const acc of accounts) {
        const tz = acc.timezone || 'America/Lima'
        const today = getTimezoneAwareDate(null, tz)
        try {
          await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, today)
        } catch (err) {
          console.error(`  ❌ ${acc.company_token} ${today}: ${err.message}`)
        }
        await sleep(INTER_ACCOUNT_SLEEP_MS)
      }
      console.log("🍔 [Cron] Today's combo stats updated")
    } catch (err) {
      console.error('❌ [Cron] Combo stats rolling error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  console.log('🍔 Combo stats cron jobs scheduled (3:30 AM final + every 2h rolling)')
}
