import cron from 'node-cron'
import { pool } from '../database.js'
import { getTimezoneAwareDate } from './olaClickService.js'
import { computeAndStoreDailyGain } from './dailyGainService.js'
import {
  fetchPublicOrdersList,
  fetchPublicOrderDetail,
  countOrderUnits,
  extractOrderFields,
  extractPayments,
  isNotFoundError
} from './publicOlaClickService.js'

// Throttling to stay well under the public API rate limit (~120/window).
// Overridable via env so a long backfill can be dialed up/down without a deploy.
const INTER_ORDER_SLEEP_MS = Number(process.env.COMBO_INTER_ORDER_SLEEP_MS) || 150
const INTER_ACCOUNT_SLEEP_MS = Number(process.env.COMBO_INTER_ACCOUNT_SLEEP_MS) || 1000
const INTER_DAY_SLEEP_MS = Number(process.env.COMBO_INTER_DAY_SLEEP_MS) || 1500

// Safety cap for deletion reconciliation: if more ledger rows than this are
// "missing" from a day's fresh list, we assume the list came back short (a
// transient API/pagination glitch) rather than a real mass-deletion, and skip
// the verify pass to avoid hammering the detail endpoint / wrongly deleting.
const MAX_RECONCILE_VERIFY = Number(process.env.COMBO_MAX_RECONCILE_VERIFY) || 50

// How many trailing days the nightly cron re-syncs (self-heals a missed night).
const NIGHTLY_FINALIZE_DAYS = 3

// Rolling reconciliation cadence (node-cron expr). Default every 5 min; set to
// e.g. '0 * * * *' (hourly) once webhooks are the primary ingestion path.
const ROLLING_SYNC_CRON = process.env.COMBO_ROLLING_SYNC_CRON || '*/5 * * * *'
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
 *   2. Load the existing ledger rows for the day (fetched flag + updated_at +
 *      status + deleted flag).
 *   3. Upsert a skeleton for every listed order (also clears deleted_at, so a
 *      reappearing order self-heals).
 *   4. For every NON-CANCELLED order that is new or whose updated_at changed,
 *      fetch detail to count combos/burgers and record per-method payments,
 *      then write the full row + replace its payment child rows atomically.
 *   5. Reconcile deletions: verify every ledger row that is missing from the
 *      list. The public list is effectively finalized-only (open orders are
 *      absent) and a deleted order returns 404 on its detail, so a 404 => stamp
 *      deleted_at; still-existing => refresh the row. Bounded by
 *      MAX_RECONCILE_VERIFY so a short list can't trigger a delete storm.
 *
 * The updated_at diff keeps detail calls bounded (unchanged orders are skipped).
 * A 429/crash mid-run only leaves unfetched gaps; the next run re-lists and
 * fetches just those.
 *
 * @param {string} companyId
 * @param {string} companyToken
 * @param {string} publicApiKey
 * @param {string} day YYYY-MM-DD (treated as the local business day)
 * @returns {Promise<{listed:number, fetched:number, skipped:number, cancelled:number, refreshed:number, deleted:number, errors:number}|null>}
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

  // Existing ledger rows for this account+day: order_id -> { fetched, updatedAt, status, deleted }
  //
  // Manually imported rows are excluded. They have no OlaClick counterpart, so
  // they can never appear in the day's list and their detail fetch would 404 —
  // leaving them in would make the reconciliation pass below soft-delete every
  // imported day the moment this account is given a public_api_key.
  const existingRes = await pool.query(
    `SELECT order_id, fetched_at, order_updated_at, burger_units, status, deleted_at
     FROM order_facts
     WHERE company_token = $1 AND day_local = $2 AND is_manual = FALSE`,
    [companyToken, day]
  )
  const existing = new Map()
  for (const r of existingRes.rows) {
    existing.set(r.order_id, {
      // Treat rows fetched before the burger columns existed as un-fetched so a
      // single pass backfills burger_units.
      fetched: r.fetched_at != null && r.burger_units != null,
      updatedAt: r.order_updated_at ? new Date(r.order_updated_at).getTime() : null,
      status: r.status || null,
      deleted: r.deleted_at != null
    })
  }

  let fetched = 0
  let skipped = 0
  let cancelled = 0
  let errors = 0
  let deletedInLoop = 0
  const listedIds = []

  for (const order of orders) {
    const orderId = order?.id ?? order?.order_id ?? order?.uuid
    if (!orderId) continue
    listedIds.push(String(orderId))
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
      if (isNotFoundError(err)) {
        // Deleted in OlaClick between the list call and this detail call.
        await markOrderDeleted(companyToken, orderId)
        deletedInLoop += 1
      } else {
        errors += 1
        console.error(`  ❌ Order detail fetch failed for ${companyToken} order ${orderId}: ${err.message}`)
      }
    }

    await sleep(INTER_ORDER_SLEEP_MS)
  }

  // Reconcile deletions. The public list is effectively finalized-only: open
  // orders (PENDING/PREPARING/…) are absent, and a deleted order returns 404 on
  // its detail. So "missing from the list" alone does NOT mean deleted — we must
  // verify each candidate against the detail endpoint:
  //   • 404            -> the order was deleted in OlaClick  -> stamp deleted_at
  //   • still exists   -> it was just open / briefly dropped -> refresh its row
  // Already-CANCELLED and already-deleted rows are skipped (revenue already
  // excludes them, no need to re-verify every run).
  const listedSet = new Set(listedIds)
  const candidates = []
  for (const [id, meta] of existing) {
    if (listedSet.has(id)) continue
    if (meta.deleted) continue
    if (normStatus(meta.status) === 'CANCELLED') continue
    candidates.push(id)
  }

  let deleted = deletedInLoop
  let refreshed = 0
  if (candidates.length > MAX_RECONCILE_VERIFY) {
    // Too many missing at once => the list almost certainly came back short
    // (transient glitch), not a real mass-deletion. Skip to avoid hammering the
    // detail endpoint and wrongly deleting live rows; the next run self-heals.
    console.warn(
      `  ⚠️  ${companyToken} ${day}: ${candidates.length} ledger rows missing from list (> ${MAX_RECONCILE_VERIFY}); skipping delete reconciliation this run`
    )
  } else {
    for (const orderId of candidates) {
      try {
        const detail = await fetchPublicOrderDetail(publicApiKey, orderId)
        if (!detail) {
          await markOrderDeleted(companyToken, orderId)
          deleted += 1
          continue
        }
        // Still exists (typically an open order not yet in the finalized list).
        // Refresh so its status/counts stay live instead of going stale.
        const dStatus = normStatus(detail.status)
        const dSource = normSource(detail.source)
        const detailFields = extractOrderFields(detail)
        if (dStatus === 'CANCELLED') {
          await upsertSkeleton({
            companyId, companyToken, orderId, dayLocal: day,
            status: dStatus, source: dSource, fields: detailFields
          })
        } else {
          const counts = countOrderUnits(detail)
          const payments = extractPayments(detail)
          await writeOrderDetail(
            {
              companyId, companyToken, orderId, dayLocal: day,
              status: dStatus, source: dSource, fields: detailFields,
              counts, paymentCount: payments.length
            },
            payments
          )
        }
        refreshed += 1
      } catch (err) {
        if (isNotFoundError(err)) {
          await markOrderDeleted(companyToken, orderId)
          deleted += 1
        } else {
          errors += 1
          console.error(`  ❌ Reconcile detail fetch failed for ${companyToken} order ${orderId}: ${err.message}`)
        }
      }
      await sleep(INTER_ORDER_SLEEP_MS)
    }
  }

  console.log(
    `  🍔 Order sync ${companyToken} ${day}: listed=${orders.length} fetched=${fetched} skipped=${skipped} cancelled=${cancelled} refreshed=${refreshed} deleted=${deleted} errors=${errors}`
  )
  return { listed: orders.length, fetched, skipped, cancelled, refreshed, deleted, errors }
}

// Soft-delete a ledger row: excluded from all reads, but kept for audit. Cleared
// automatically by upsertSkeleton if the order ever reappears in the list.
// Exported so the webhook receiver (ORDER_DELETED) can reuse it. Returns the
// number of rows affected (0 if the order was never ledgered).
export async function markOrderDeleted(companyToken, orderId) {
  const res = await pool.query(
    `UPDATE order_facts SET deleted_at = NOW()
     WHERE company_token = $1 AND order_id = $2 AND deleted_at IS NULL`,
    [companyToken, orderId]
  )
  return res.rowCount || 0
}

// Which local business day an order belongs to. Prefer created/pending time so a
// row stays on its origin day even after it finalizes late at night; falls back
// to closed/updated, then now.
function localDayFromOrder(order, timezone) {
  const ts = order?.created_at || order?.pending_at || order?.closed_at || order?.updated_at
  const d = ts ? new Date(ts) : new Date()
  // en-CA formats as YYYY-MM-DD; timeZone pins it to the account's local day.
  return d.toLocaleDateString('en-CA', { timeZone: timezone || 'America/Lima' })
}

/**
 * Sync a SINGLE order into the ledger (used by the webhook receiver for
 * near-real-time ORDER_CREATED / ORDER_UPDATED, and reusable for deletions).
 * One detail call: 404 => the order was deleted => soft-delete; otherwise upsert
 * the full row (or a CANCELLED skeleton). Idempotent — safe to call repeatedly
 * and safe to run alongside the day-level poll (both upsert by (token,order_id)).
 *
 * @param {string} companyId
 * @param {string} companyToken
 * @param {string} publicApiKey
 * @param {string} orderId
 * @param {string} [timezone] account tz, for the day_local bucket
 * @returns {Promise<{action:'deleted'|'cancelled'|'upserted'}>}
 */
export async function syncSingleOrder(companyId, companyToken, publicApiKey, orderId, timezone) {
  if (!publicApiKey) throw new Error('public_api_key is required')
  if (!orderId) throw new Error('orderId is required')

  let detail
  try {
    detail = await fetchPublicOrderDetail(publicApiKey, orderId)
  } catch (err) {
    if (isNotFoundError(err)) {
      await markOrderDeleted(companyToken, orderId)
      return { action: 'deleted' }
    }
    throw err
  }
  if (!detail) {
    await markOrderDeleted(companyToken, orderId)
    return { action: 'deleted' }
  }

  const status = normStatus(detail.status)
  const source = normSource(detail.source)
  const fields = extractOrderFields(detail)
  const dayLocal = localDayFromOrder(detail, timezone)

  if (status === 'CANCELLED') {
    // Keep the row (excluded from reads via status filter), don't waste a
    // combo/payment write on a cancelled order.
    await upsertSkeleton({ companyId, companyToken, orderId, dayLocal, status, source, fields })
    return { action: 'cancelled' }
  }

  const counts = countOrderUnits(detail)
  const payments = extractPayments(detail)
  await writeOrderDetail(
    {
      companyId, companyToken, orderId, dayLocal,
      status, source, fields, counts, paymentCount: payments.length
    },
    payments
  )
  return { action: 'upserted' }
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
       order_updated_at = EXCLUDED.order_updated_at,
       deleted_at = NULL`,
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
         deleted_at = NULL,
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
    `SELECT ca.company_id, ca.company_token, ca.public_api_key, ca.api_token, c.timezone
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

  // Rolling reconciliation of today's snapshot. With webhooks live this is a
  // safety net (heals missed deliveries + catches hard-deletes if an
  // ORDER_DELETED event was dropped), so the cadence is env-tunable: keep
  // */5 for poll-primary, or dial down to e.g. '0 * * * *' (hourly) once
  // webhooks are proven. updated_at diffing keeps each run cheap; guarded so
  // runs never overlap.
  //
  // After each account's ledger sync we also recompute today's daily_gains row
  // for that account (ledger-only DB queries, so it's cheap). This replaced the
  // separate every-2h daily-gains rolling cron — one cron, ledger first, gains
  // derived from it.
  cron.schedule(ROLLING_SYNC_CRON, async () => {
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
        try {
          await computeAndStoreDailyGain(acc.company_id, acc.company_token, acc.api_token, today, tz)
        } catch (err) {
          console.error(`  ❌ daily gain ${acc.company_token} ${today}: ${err.message}`)
        }
        await sleep(INTER_ACCOUNT_SLEEP_MS)
      }
    } catch (err) {
      console.error('❌ [Cron] Order stats rolling error:', err.message)
    } finally {
      rollingSyncRunning = false
    }
  }, { timezone: 'America/Lima' })

  console.log(`🍔 Order stats cron jobs scheduled (3:30 AM finalize + rolling "${ROLLING_SYNC_CRON}" incl. today's daily gains)`)
}
