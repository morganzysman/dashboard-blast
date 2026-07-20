import cron from 'node-cron'
import { pool } from '../database.js'
import { getTimezoneAwareDate } from './olaClickService.js'
import {
  fetchPublicOrdersList,
  fetchPublicOrderDetail,
  countOrderUnits,
  extractOrderFields,
  extractPayments
} from './publicOlaClickService.js'

// Throttling to stay well under the public API rate limit (~120/window).
// Overridable via env so a long backfill can be dialed up/down without a deploy.
const INTER_ORDER_SLEEP_MS = Number(process.env.COMBO_INTER_ORDER_SLEEP_MS) || 150
const INTER_ACCOUNT_SLEEP_MS = Number(process.env.COMBO_INTER_ACCOUNT_SLEEP_MS) || 1000
const INTER_DAY_SLEEP_MS = Number(process.env.COMBO_INTER_DAY_SLEEP_MS) || 1500

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

/**
 * Sync the per-order ledger for one account on one local day. Idempotent and
 * resumable:
 *   1. List the day's orders via the public API. The list carries order-level
 *      revenue (total, tips, discounts, fees, source, service_type), so we
 *      persist those in the skeleton without a detail call.
 *   2. Load the existing ledger rows for the day (fetched flag + updated_at).
 *   3. Upsert a skeleton for every listed order.
 *   4. For every NON-CANCELLED order that is new or whose updated_at changed,
 *      fetch detail to count combos/burgers and record per-method payments,
 *      then write the full row + replace its payment child rows atomically.
 *
 * We no longer gate on terminal status — open orders are fetched too so the
 * ledger reflects live activity. The updated_at diff keeps detail calls bounded
 * (unchanged orders are skipped). A 429/crash mid-run only leaves unfetched
 * gaps; the next run re-lists and fetches just those.
 *
 * @param {string} companyId
 * @param {string} companyToken
 * @param {string} publicApiKey
 * @param {string} day YYYY-MM-DD (treated as the local business day)
 * @returns {Promise<{listed:number, fetched:number, skipped:number, cancelled:number, errors:number}|null>}
 */
export async function syncComboFactsForDay(companyId, companyToken, publicApiKey, day) {
  if (!publicApiKey) {
    console.warn(`  ⏭️  ${companyToken} ${day}: no public_api_key, skipping order sync`)
    return null
  }

  let orders
  try {
    orders = await fetchPublicOrdersList(publicApiKey, { startDate: day, endDate: day })
  } catch (err) {
    console.error(`  ❌ Order list fetch failed for ${companyToken} ${day}: ${err.message}`)
    return null
  }

  // Existing ledger rows for this account+day: order_id -> { fetched, updatedAt }
  const existingRes = await pool.query(
    `SELECT order_id, fetched_at, order_updated_at, burger_units
     FROM order_facts
     WHERE company_token = $1 AND day_local = $2`,
    [companyToken, day]
  )
  const existing = new Map()
  for (const r of existingRes.rows) {
    existing.set(r.order_id, {
      // Treat rows fetched before the burger columns existed as un-fetched so a
      // single pass backfills burger_units.
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
    const fields = extractOrderFields(order)
    const updatedAtMs = fields.updatedAt ? new Date(fields.updatedAt).getTime() : null

    // Always keep the order-level skeleton up to date (status/source/revenue can
    // change between runs). Never touches combo/burger/payment/fetched columns.
    await upsertSkeleton({
      companyId,
      companyToken,
      orderId,
      dayLocal: day,
      status,
      source,
      fields
    })

    if (status === 'CANCELLED') {
      cancelled += 1
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

    // New or changed: fetch detail for combo/burger counts + payment methods.
    try {
      const detail = await fetchPublicOrderDetail(publicApiKey, orderId)
      const counts = countOrderUnits(detail)
      const detailFields = extractOrderFields(detail)
      const payments = extractPayments(detail)
      await writeOrderDetail(
        {
          companyId,
          companyToken,
          orderId,
          dayLocal: day,
          status: normStatus(detail?.status) || status,
          source: normSource(detail?.source) || source,
          fields: { ...fields, ...detailFields },
          counts,
          paymentCount: payments.length
        },
        payments
      )
      fetched += 1
    } catch (err) {
      errors += 1
      console.error(`  ❌ Order detail fetch failed for ${companyToken} order ${orderId}: ${err.message}`)
    }

    await sleep(INTER_ORDER_SLEEP_MS)
  }

  console.log(
    `  🍔 Order sync ${companyToken} ${day}: listed=${orders.length} fetched=${fetched} skipped=${skipped} cancelled=${cancelled} errors=${errors}`
  )
  return { listed: orders.length, fetched, skipped, cancelled, errors }
}

// Skeleton upsert: order-level fields only (revenue comes cheaply from the list
// endpoint). Never touches the combo/burger/payment/fetched_at columns so a
// listing pass can't wipe a previously fetched order's counts.
async function upsertSkeleton({ companyId, companyToken, orderId, dayLocal, status, source, fields }) {
  await pool.query(
    `INSERT INTO order_facts
       (company_id, company_token, order_id, day_local, status, source,
        order_total, total_paid, tips_total, discounts_total, service_fee, service_type, order_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (company_token, order_id) DO UPDATE SET
       status = EXCLUDED.status,
       source = EXCLUDED.source,
       day_local = EXCLUDED.day_local,
       order_total = EXCLUDED.order_total,
       total_paid = EXCLUDED.total_paid,
       tips_total = EXCLUDED.tips_total,
       discounts_total = EXCLUDED.discounts_total,
       service_fee = EXCLUDED.service_fee,
       service_type = EXCLUDED.service_type,
       order_updated_at = EXCLUDED.order_updated_at`,
    [
      companyId, companyToken, orderId, dayLocal, status, source,
      fields.orderTotal, fields.totalPaid, fields.tipsTotal, fields.discountsTotal,
      fields.serviceFee, fields.serviceType, fields.updatedAt
    ]
  )
}

// Full write after a detail fetch: order-level revenue + combo/burger counts +
// closed_at + payment_count, then replace the order's payment child rows. Done
// in a transaction so counts and payments never drift apart.
async function writeOrderDetail(
  { companyId, companyToken, orderId, dayLocal, status, source, fields, counts, paymentCount },
  payments
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO order_facts
         (company_id, company_token, order_id, day_local, status, source,
          order_total, total_paid, tips_total, discounts_total, service_fee, service_type,
          combo_units, combo_lines, has_combo,
          burger_units, burger_lines, has_burger,
          payment_count, closed_at, order_updated_at, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
       ON CONFLICT (company_token, order_id) DO UPDATE SET
         status = EXCLUDED.status,
         source = EXCLUDED.source,
         day_local = EXCLUDED.day_local,
         order_total = EXCLUDED.order_total,
         total_paid = EXCLUDED.total_paid,
         tips_total = EXCLUDED.tips_total,
         discounts_total = EXCLUDED.discounts_total,
         service_fee = EXCLUDED.service_fee,
         service_type = EXCLUDED.service_type,
         combo_units = EXCLUDED.combo_units,
         combo_lines = EXCLUDED.combo_lines,
         has_combo = EXCLUDED.has_combo,
         burger_units = EXCLUDED.burger_units,
         burger_lines = EXCLUDED.burger_lines,
         has_burger = EXCLUDED.has_burger,
         payment_count = EXCLUDED.payment_count,
         closed_at = EXCLUDED.closed_at,
         order_updated_at = EXCLUDED.order_updated_at,
         fetched_at = NOW()`,
      [
        companyId, companyToken, orderId, dayLocal, status, source,
        fields.orderTotal, fields.totalPaid, fields.tipsTotal, fields.discountsTotal,
        fields.serviceFee, fields.serviceType,
        counts.comboUnits, counts.comboLines, counts.hasCombo,
        counts.burgerUnits, counts.burgerLines, counts.hasBurger,
        paymentCount, fields.closedAt, fields.updatedAt
      ]
    )

    // Replace the order's payment rows wholesale (handles split / changed payments).
    await client.query(
      `DELETE FROM order_payment_facts WHERE company_token = $1 AND order_id = $2`,
      [companyToken, orderId]
    )
    for (let i = 0; i < payments.length; i += 1) {
      const p = payments[i]
      await client.query(
        `INSERT INTO order_payment_facts
           (company_id, company_token, order_id, seq, day_local, method,
            bill_amount, received_amount, tip_amount, fee_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          companyId, companyToken, orderId, i, dayLocal, p.method,
          p.billAmount, p.receivedAmount, p.tipAmount, p.feeAmount
        ]
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
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
 * Backfill order facts for a date range across accounts (all, or one company).
 * Idempotent/resumable thanks to the ledger. Throttled to respect rate limits.
 *
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string|null} companyId
 */
export async function backfillComboStats(startDate, endDate, companyId = null) {
  const accounts = await loadComboAccounts(companyId)
  if (accounts.length === 0) {
    console.log('🍔 Order backfill: no accounts with a public_api_key')
    return 0
  }

  const days = []
  const cur = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  console.log(`🍔 Order backfill: ${accounts.length} account(s) × ${days.length} day(s) (${startDate} → ${endDate})`)
  let processed = 0
  for (const acc of accounts) {
    for (const day of days) {
      try {
        await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
      } catch (err) {
        console.error(`  ❌ Order backfill error ${acc.company_token} ${day}: ${err.message}`)
      }
      processed += 1
      await sleep(INTER_DAY_SLEEP_MS)
    }
    await sleep(INTER_ACCOUNT_SLEEP_MS)
  }
  console.log(`🍔 Order backfill complete: ${processed} account-days`)
  return processed
}

/**
 * Boot-time backfill of a bounded recent window, only for accounts that have a
 * public API key. Runs in the background. Cheap on re-run because already-synced
 * orders (unchanged updated_at) are skipped.
 */
export async function autoBackfillComboStatsIfNeeded() {
  try {
    const accounts = await loadComboAccounts()
    if (accounts.length === 0) {
      console.log('🍔 No accounts with public_api_key, skipping order auto-backfill')
      return
    }
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

      console.log(`🍔 Order auto-backfill ${acc.company_token}: ${days.length} day(s)`)
      for (const day of days) {
        try {
          await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
        } catch (err) {
          console.error(`  ❌ Order auto-backfill error ${acc.company_token} ${day}: ${err.message}`)
        }
        await sleep(INTER_DAY_SLEEP_MS)
      }
      await sleep(INTER_ACCOUNT_SLEEP_MS)
    }
    console.log('🍔 Order auto-backfill complete')
  } catch (err) {
    console.log('🍔 order_facts not ready, skipping order auto-backfill:', err.message)
  }
}

// Overlap guard: the 5-minute rolling sync can run long on a busy day; skip a
// tick rather than let two passes hammer the API and race on the same rows.
let rollingSyncRunning = false

/** Schedule order-stats cron jobs (nightly finalize + 5-minute rolling today). */
export function scheduleComboStatsCron() {
  // 3:30 AM Lima — finalize the last few closed days (self-heal missed nights).
  cron.schedule('30 3 * * *', async () => {
    console.log(`🍔 [Cron] Finalizing last ${NIGHTLY_FINALIZE_DAYS} day(s) of order stats...`)
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
      console.log('🍔 [Cron] Order stats finalized')
    } catch (err) {
      console.error('❌ [Cron] Order stats nightly error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  // Every 5 minutes — refresh today's rolling snapshot. updated_at diffing keeps
  // this cheap (only new/changed orders trigger a detail fetch). Guarded so runs
  // never overlap.
  cron.schedule('*/5 * * * *', async () => {
    if (rollingSyncRunning) {
      console.log('🍔 [Cron] Rolling order sync still running — skipping this tick')
      return
    }
    rollingSyncRunning = true
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
    } catch (err) {
      console.error('❌ [Cron] Order stats rolling error:', err.message)
    } finally {
      rollingSyncRunning = false
    }
  }, { timezone: 'America/Lima' })

  console.log('🍔 Order stats cron jobs scheduled (3:30 AM finalize + every 5 min rolling)')
}
