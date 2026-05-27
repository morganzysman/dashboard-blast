#!/usr/bin/env node

/**
 * Recompute daily_gains.orders_count from 2026-01-01 through yesterday (Lima).
 *
 * Background:
 *   `orders_count` was previously summed from OlaClick's /by_payment_methods
 *   `count` field, which double-counts orders paid with split payments
 *   (e.g. cash + Yape produces two rows that both get counted). The bug was
 *   fixed in dailyGainService.js — `orders_count` now derives from the
 *   distinct /orders list, filtered to non-cancelled to match the calendar's
 *   existing semantics.
 *
 *   This script back-fills every (company, account, day) row in daily_gains
 *   since 2026-01-01 by re-invoking the fixed computeAndStoreDailyGain. It
 *   reuses the same throttling pattern as backfillGains (2s between calls)
 *   and is idempotent via the existing UPSERT on
 *   (company_id, company_token, date).
 *
 * Safety:
 *   - Read-mostly + UPSERT-only. No destructive SQL.
 *   - Re-running produces identical results.
 *   - Per-row errors are logged but don't abort the run; the row keeps its
 *     old (over-counted) value and can be retried by re-running the script.
 *
 * Usage:
 *   node server/scripts/recompute-daily-orders-count.js
 */

import { pool } from '../database.js'
import { computeAndStoreDailyGain } from '../services/dailyGainService.js'

const START_DATE = '2026-01-01'
const INTER_CALL_SLEEP_MS = 2000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Yesterday in America/Lima — matches the daily-gains cadence (the cron runs
// at 03:00 Lima time and computes "yesterday Lima"). Recomputing up to and
// including yesterday avoids racing the still-in-progress current day.
function getYesterdayInLima() {
  const now = new Date()
  const todayLima = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const d = new Date(todayLima + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function buildDayList(startDate, endDate) {
  const days = []
  const cur = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

async function main() {
  const endDate = getYesterdayInLima()
  if (endDate < START_DATE) {
    console.log(`📊 Nothing to recompute (start=${START_DATE}, end=${endDate}).`)
    await pool.end()
    process.exit(0)
  }

  // Enumerate (company_id, company_token, api_token, timezone) tuples that
  // actually have rows in daily_gains since START_DATE. We join on
  // company_accounts to pick up api_token (daily_gains stores only the
  // company_token); rows whose account has since been removed from
  // company_accounts are flagged and skipped — they can't be recomputed
  // without credentials.
  const tuplesRes = await pool.query(
    `
    SELECT DISTINCT
      dg.company_id,
      dg.company_token,
      ca.api_token,
      c.timezone
    FROM daily_gains dg
    JOIN companies c ON c.id = dg.company_id
    LEFT JOIN company_accounts ca
      ON ca.company_id = dg.company_id
     AND ca.company_token = dg.company_token
    WHERE dg.date >= $1
    ORDER BY dg.company_id, dg.company_token
    `,
    [START_DATE]
  )

  const tuples = []
  for (const r of tuplesRes.rows) {
    if (!r.api_token) {
      console.warn(`⚠️  Skipping ${r.company_token} — no matching company_accounts row (account removed?)`)
      continue
    }
    tuples.push(r)
  }

  if (tuples.length === 0) {
    console.log('📊 No (account, day) tuples to recompute.')
    await pool.end()
    process.exit(0)
  }

  const days = buildDayList(START_DATE, endDate)
  const total = tuples.length * days.length

  console.log('📊 Recompute plan')
  console.log(`   Accounts: ${tuples.length}`)
  console.log(`   Days:     ${days.length} (${START_DATE} → ${endDate})`)
  console.log(`   Total (account, day) recomputes: ${total}`)
  console.log(`   Throttle: ${INTER_CALL_SLEEP_MS}ms between recomputes`)
  console.log('')

  const startedAt = Date.now()
  let processed = 0
  let updated = 0
  let skipped = 0
  let errored = 0
  let totalOldOrders = 0
  let totalNewOrders = 0

  for (const t of tuples) {
    for (const day of days) {
      processed += 1

      // Read the existing orders_count first so we can print the diff. This
      // is a tiny indexed lookup; cost is dwarfed by the OlaClick calls.
      let oldOrders = null
      try {
        const oldRes = await pool.query(
          'SELECT orders_count FROM daily_gains WHERE company_id = $1 AND company_token = $2 AND date = $3',
          [t.company_id, t.company_token, day]
        )
        if (oldRes.rows.length > 0) {
          oldOrders = Number(oldRes.rows[0].orders_count) || 0
        }
      } catch (err) {
        console.error(`[${processed}/${total}] company=${t.company_token} day=${day} — DB read error: ${err.message}`)
      }

      let result = null
      try {
        result = await computeAndStoreDailyGain(
          t.company_id,
          t.company_token,
          t.api_token,
          day,
          t.timezone || 'America/Lima'
        )
      } catch (err) {
        errored += 1
        console.error(`[${processed}/${total}] company=${t.company_token} day=${day} — ERROR: ${err.message}`)
      }

      if (result && Number.isFinite(result.ordersCount)) {
        const newOrders = result.ordersCount
        const oldForDiff = oldOrders ?? 0
        const diff = oldForDiff - newOrders
        updated += 1
        totalOldOrders += oldForDiff
        totalNewOrders += newOrders
        const diffStr = diff > 0 ? `-${diff}` : diff < 0 ? `+${Math.abs(diff)}` : '0'
        const oldStr = oldOrders === null ? '(new row)' : String(oldOrders)
        console.log(
          `[${processed}/${total}] company=${t.company_token} day=${day} orders_old=${oldStr} orders_new=${newOrders} diff=${diffStr}`
        )
      } else if (!result) {
        skipped += 1
        console.log(`[${processed}/${total}] company=${t.company_token} day=${day} — SKIPPED (no result from OlaClick)`)
      }

      await sleep(INTER_CALL_SLEEP_MS)
    }
  }

  const elapsedMs = Date.now() - startedAt
  const elapsedMin = (elapsedMs / 60000).toFixed(1)
  const subtracted = totalOldOrders - totalNewOrders

  console.log('')
  console.log('────────────────────────────────────────')
  console.log('📊 Recompute complete')
  console.log(`   Processed:        ${processed}`)
  console.log(`   Rows updated:     ${updated}`)
  console.log(`   Skipped:          ${skipped}`)
  console.log(`   Errored:          ${errored}`)
  console.log(`   Total orders old: ${totalOldOrders}`)
  console.log(`   Total orders new: ${totalNewOrders}`)
  console.log(`   Total subtracted: ${subtracted} (positive = bug had been over-counting by this many)`)
  console.log(`   Elapsed:          ${elapsedMin} min`)

  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌ Recompute failed:', err)
  try {
    await pool.end()
  } catch {
    // Pool may already be closed.
  }
  process.exit(1)
})
