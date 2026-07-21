#!/usr/bin/env node

/**
 * Recompute daily_gains from the local order ledger.
 *
 * Daily gains are derived entirely from the ledger (order_facts +
 * order_payment_facts) — no OlaClick API calls — so a full recompute is cheap
 * and idempotent. Use this after a ledger backfill, or any time daily_gains
 * drifts out of sync (missing days, rows frozen at $0, stale intraday
 * snapshots, or values left over from the old cookie API).
 *
 * By default it recomputes every day for every keyed account, from each
 * account's earliest ledger day through today (in the company timezone).
 *
 * Usage:
 *   node server/scripts/recompute-daily-gains.mjs [options]
 *
 * Options:
 *   --token <company_token>   Only this account (repeatable).
 *   --from <YYYY-MM-DD>       Start date (default: account's earliest ledger day).
 *   --to <YYYY-MM-DD>         End date (default: today in the account timezone).
 *   --sleep <ms>             Delay between days (default: 0).
 *   --dry-run                Report the range per account; write nothing.
 *
 * Examples:
 *   node server/scripts/recompute-daily-gains.mjs
 *   node server/scripts/recompute-daily-gains.mjs --token blast-smash-burgers
 *   node server/scripts/recompute-daily-gains.mjs --from 2026-07-01 --to 2026-07-20
 *
 * Against production (Railway):
 *   DATABASE_URL="$PROD_DB" node server/scripts/recompute-daily-gains.mjs
 */

import { pool } from '../database.js'
import { computeAndStoreDailyGain } from '../services/dailyGainService.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs(argv) {
  const opts = { tokens: [], from: null, to: null, sleep: 0, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--token') opts.tokens.push(argv[++i])
    else if (a === '--from') opts.from = argv[++i]
    else if (a === '--to') opts.to = argv[++i]
    else if (a === '--sleep') opts.sleep = Number(argv[++i]) || 0
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

// Today's date (YYYY-MM-DD) in a given IANA timezone.
function todayInTz(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'America/Lima' })
}

// Inclusive day list between two YYYY-MM-DD strings (UTC-noon anchored to avoid DST edges).
function dayList(from, to) {
  const out = []
  const cur = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  for (let d = new Date(cur); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: node server/scripts/recompute-daily-gains.mjs [--token T]... [--from D] [--to D] [--sleep ms] [--dry-run]')
    await pool.end()
    process.exit(0)
  }

  // Keyed accounts (ledger-backed) with their company timezone and earliest ledger day.
  const params = []
  let tokenFilter = ''
  if (opts.tokens.length) {
    tokenFilter = `AND ca.company_token = ANY($1)`
    params.push(opts.tokens)
  }
  const accs = (await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.api_token, c.timezone,
            (SELECT MIN(day_local) FROM order_facts o WHERE o.company_token = ca.company_token) AS min_day
     FROM company_accounts ca
     JOIN companies c ON c.id = ca.company_id
     WHERE ca.public_api_key IS NOT NULL ${tokenFilter}
     ORDER BY ca.company_token`,
    params
  )).rows

  if (accs.length === 0) {
    console.log('No keyed accounts found (need public_api_key).')
    await pool.end()
    process.exit(0)
  }

  console.log(`📊 Recompute daily_gains from ledger${opts.dryRun ? ' (dry-run)' : ''} — ${accs.length} account(s)`)

  let grandTotal = 0
  let grandErrors = 0

  for (const a of accs) {
    const tz = a.timezone || 'America/Lima'
    const from = opts.from || (a.min_day ? a.min_day.toISOString().slice(0, 10) : null)
    const to = opts.to || todayInTz(tz)

    if (!from) {
      console.log(`\n>> ${a.company_token}: no ledger data, skipping`)
      continue
    }

    const days = dayList(from, to)
    console.log(`\n>> ${a.company_token}: ${days.length} day(s) (${from} → ${to})`)

    if (opts.dryRun) {
      grandTotal += days.length
      continue
    }

    let i = 0
    let errs = 0
    for (const day of days) {
      i++
      grandTotal++
      try {
        await computeAndStoreDailyGain(a.company_id, a.company_token, a.api_token, day, tz)
      } catch (err) {
        errs++
        grandErrors++
        console.error(`   ✗ ${day} — ${err.message}`)
      }
      if (i % 60 === 0) console.log(`   ...${i}/${days.length} (${day})`)
      if (opts.sleep > 0 && i < days.length) await sleep(opts.sleep)
    }
    console.log(`   ✅ ${a.company_token}: ${i - errs}/${days.length} recomputed${errs ? `, ${errs} error(s)` : ''}`)
  }

  console.log('────────────────────────────────────────')
  console.log(`📊 Done: ${grandTotal} account-day(s)${opts.dryRun ? ' (dry-run)' : ` recomputed, ${grandErrors} error(s)`}`)
  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌ Recompute failed:', err)
  try {
    await pool.end()
  } catch {
    // pool already closed
  }
  process.exit(1)
})
