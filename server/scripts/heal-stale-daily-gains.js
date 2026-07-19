#!/usr/bin/env node

/**
 * Heal STALE daily_gains rows — past days whose stored value is only a
 * partial-day (mid-day) snapshot that never got finalized.
 *
 * A row is "final" only if it was last computed AFTER the day closed in the
 * account's timezone. The rolling intraday cron writes snapshots during the
 * day; the nightly cron is supposed to overwrite them with the closed-day
 * total. If the nightly run is missed (deploy/outage) or the OlaClick fetch
 * fails that night, the row stays frozen at a partial value — which silently
 * corrupts the same-weekday "record to beat" (e.g. a Saturday's dinner service
 * never gets counted, so the record falls back to an older, lower day).
 *
 * This script finds every such row (date < today AND last computed on/before
 * that same day, per the company timezone) and recomputes it from OlaClick.
 *
 * Usage:
 *   node server/scripts/heal-stale-daily-gains.js [--dry-run]
 *
 * Safety: --dry-run only reads. Otherwise it UPSERTs recomputed rows (idempotent).
 */

import { pool } from '../database.js'
import { computeAndStoreDailyGain } from '../services/dailyGainService.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  // Stale = past day (in the company tz) whose computed_at (in that tz) lands on
  // or before the day itself → it was only ever an intraday snapshot.
  const staleRes = await pool.query(`
    SELECT dg.company_id,
           dg.company_token,
           ca.api_token,
           c.timezone,
           to_char(dg.date, 'YYYY-MM-DD') AS date,
           dg.gross_revenue::float8 AS stored_gross,
           ca.account_name
    FROM daily_gains dg
    JOIN companies c ON c.id = dg.company_id
    LEFT JOIN company_accounts ca
      ON ca.company_id = dg.company_id AND ca.company_token = dg.company_token
    WHERE dg.date < (now() AT TIME ZONE c.timezone)::date
      AND (dg.computed_at AT TIME ZONE c.timezone)::date <= dg.date
    ORDER BY dg.date, ca.account_name
  `)

  if (staleRes.rows.length === 0) {
    console.log('✅ No stale daily_gains rows found.')
    await pool.end()
    process.exit(0)
  }

  console.log(`📊 Found ${staleRes.rows.length} stale row(s)${DRY_RUN ? ' (dry-run, no writes)' : ''}:`)
  for (const r of staleRes.rows) {
    console.log(`   ${r.account_name || r.company_token}  ${r.date}  stored=S/ ${Number(r.stored_gross).toFixed(2)}`)
  }

  if (DRY_RUN) {
    await pool.end()
    process.exit(0)
  }

  let healed = 0
  let skipped = 0
  let errored = 0

  for (let i = 0; i < staleRes.rows.length; i++) {
    const r = staleRes.rows[i]
    if (!r.api_token) {
      console.warn(`⚠️  ${r.company_token} ${r.date} — no api_token (account removed?), skipping`)
      skipped += 1
      continue
    }
    try {
      const result = await computeAndStoreDailyGain(
        r.company_id,
        r.company_token,
        r.api_token,
        r.date,
        r.timezone || 'America/Lima'
      )
      if (result) {
        healed += 1
        const diff = (result.gross ?? 0) - Number(r.stored_gross)
        console.log(
          `✅ [${i + 1}/${staleRes.rows.length}] ${r.company_token} ${r.date} — ${Number(r.stored_gross).toFixed(2)} → ${(result.gross ?? 0).toFixed(2)} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})`
        )
      } else {
        skipped += 1
        console.log(`⚠️  [${i + 1}/${staleRes.rows.length}] ${r.company_token} ${r.date} — no OlaClick data, left unchanged`)
      }
    } catch (err) {
      errored += 1
      console.error(`❌ [${i + 1}/${staleRes.rows.length}] ${r.company_token} ${r.date} — ${err.message}`)
    }
    if (i < staleRes.rows.length - 1) await sleep(2000)
  }

  console.log('────────────────────────────────────────')
  console.log(`📊 Heal complete: ${healed} healed, ${skipped} skipped, ${errored} errored`)
  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌ Heal failed:', err)
  try {
    await pool.end()
  } catch {
    // pool already closed
  }
  process.exit(1)
})
