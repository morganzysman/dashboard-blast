#!/usr/bin/env node
/**
 * CLI: backfill the per-order ledger (order_facts + order_payment_facts) from the
 * OlaClick Public API, with live progress you can watch in the terminal.
 *
 * It reuses syncComboFactsForDay (idempotent + resumable): re-running skips
 * orders whose updated_at hasn't changed, so a crash / Ctrl-C / 429 storm just
 * means you re-run and it picks up the gaps. Throttling is handled inside the
 * sync (tunable via COMBO_INTER_*_SLEEP_MS env vars).
 *
 * Usage:
 *   node server/scripts/backfill-ledger.mjs --from 2024-01-01 --to 2026-07-20
 *   node server/scripts/backfill-ledger.mjs --from 2024-01-01            # --to defaults to today
 *   node server/scripts/backfill-ledger.mjs --from 2024-01-01 --token BARRANCO_TEST
 *   node server/scripts/backfill-ledger.mjs --from 2024-01-01 --company <uuid> --desc
 *
 * Flags:
 *   --from <YYYY-MM-DD>   start day (inclusive, required)
 *   --to   <YYYY-MM-DD>   end day (inclusive, default = today in each account's tz)
 *   --company <uuid>      only this company's accounts
 *   --token <token>       only this company_token
 *   --desc               process newest day first (default: oldest first)
 *
 * DB connection comes from the app config (DATABASE_URL or DB_* env vars), same
 * as the server. Throttle overrides: COMBO_INTER_ORDER_SLEEP_MS,
 * COMBO_INTER_ACCOUNT_SLEEP_MS, COMBO_INTER_DAY_SLEEP_MS.
 */

import { pool } from '../database.js'
import { syncComboFactsForDay } from '../services/comboStatsService.js'

// ---------- arg parsing ----------
function parseArgs(argv) {
  const args = { desc: false }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--desc') args.desc = true
    else if (a === '--from') args.from = argv[++i]
    else if (a === '--to') args.to = argv[++i]
    else if (a === '--company') args.company = argv[++i]
    else if (a === '--token') args.token = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
    else console.warn(`⚠️  Ignoring unknown arg: ${a}`)
  }
  return args
}

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
}

function todayInTz(tz) {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'America/Lima' })
}

// Inclusive list of YYYY-MM-DD between from..to (UTC-noon anchored to avoid DST drift).
function dayRange(from, to, desc) {
  const days = []
  const cur = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  if (desc) days.reverse()
  return days
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

function bar(pct, width = 24) {
  const filled = Math.round((pct / 100) * width)
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

function fmtInt(n) {
  return n.toLocaleString('en-US')
}

async function loadAccounts({ company, token }) {
  const params = []
  let where = 'ca.public_api_key IS NOT NULL'
  if (company) {
    params.push(company)
    where += ` AND ca.company_id = $${params.length}`
  }
  if (token) {
    params.push(token)
    where += ` AND ca.company_token = $${params.length}`
  }
  const res = await pool.query(
    `SELECT ca.company_id, ca.company_token, ca.account_name, ca.public_api_key, c.timezone
     FROM company_accounts ca
     JOIN companies c ON c.id = ca.company_id
     WHERE ${where}
     ORDER BY ca.account_name, ca.company_token`,
    params
  )
  return res.rows
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.help || !args.from) {
    console.log(`Backfill the order ledger from the OlaClick Public API.

  node server/scripts/backfill-ledger.mjs --from 2024-01-01 [--to YYYY-MM-DD]
                                          [--company <uuid>] [--token <token>] [--desc]

DB uses DATABASE_URL / DB_* env. Throttle: COMBO_INTER_ORDER_SLEEP_MS,
COMBO_INTER_ACCOUNT_SLEEP_MS, COMBO_INTER_DAY_SLEEP_MS.`)
    await pool.end()
    process.exit(args.help ? 0 : 1)
  }

  if (!isYmd(args.from)) {
    console.error(`❌ --from must be YYYY-MM-DD (got: ${args.from})`)
    await pool.end()
    process.exit(1)
  }
  if (args.to && !isYmd(args.to)) {
    console.error(`❌ --to must be YYYY-MM-DD (got: ${args.to})`)
    await pool.end()
    process.exit(1)
  }

  const accounts = await loadAccounts(args)
  if (accounts.length === 0) {
    console.error('❌ No accounts with a public_api_key match the filters. Set keys first (company_accounts.public_api_key).')
    await pool.end()
    process.exit(1)
  }

  // Build per-account day lists (each capped at that account's local "today").
  const plans = accounts.map((acc) => {
    const to = args.to || todayInTz(acc.timezone)
    return { acc, days: dayRange(args.from, to, args.desc), to }
  })
  const totalAccountDays = plans.reduce((s, p) => s + p.days.length, 0)

  // Running aggregates.
  const totals = { listed: 0, fetched: 0, skipped: 0, cancelled: 0, errors: 0 }
  let doneDays = 0
  let daysWithErrors = 0
  const startedAt = Date.now()
  let stopping = false

  const printSummary = (label) => {
    const elapsed = Date.now() - startedAt
    const rate = totals.fetched / Math.max(1, elapsed / 60000)
    console.log(`\n──────── ${label} ────────`)
    console.log(`  Account-days processed : ${fmtInt(doneDays)} / ${fmtInt(totalAccountDays)}`)
    console.log(`  Orders listed          : ${fmtInt(totals.listed)}`)
    console.log(`  Details fetched        : ${fmtInt(totals.fetched)}  (${rate.toFixed(1)}/min)`)
    console.log(`  Skipped (unchanged)    : ${fmtInt(totals.skipped)}`)
    console.log(`  Cancelled              : ${fmtInt(totals.cancelled)}`)
    console.log(`  Errors                 : ${fmtInt(totals.errors)}  (days w/ errors: ${daysWithErrors})`)
    console.log(`  Elapsed                : ${fmtDuration(elapsed)}`)
    console.log('────────────────────────────────────')
  }

  process.on('SIGINT', () => {
    if (stopping) process.exit(130)
    stopping = true
    console.log('\n⏸️  Ctrl-C received — finishing current day then stopping (re-run to resume)…')
  })

  console.log(`\n🚀 Ledger backfill starting`)
  console.log(`   Range     : ${args.from} → ${args.to || '(today per account tz)'}${args.desc ? '  [newest first]' : ''}`)
  console.log(`   Accounts  : ${accounts.map((a) => a.account_name || a.company_token).join(', ')}`)
  console.log(`   Account-days: ${fmtInt(totalAccountDays)}`)
  console.log(`   Throttle  : order=${process.env.COMBO_INTER_ORDER_SLEEP_MS || 150}ms account=${process.env.COMBO_INTER_ACCOUNT_SLEEP_MS || 1000}ms day=${process.env.COMBO_INTER_DAY_SLEEP_MS || 1500}ms`)
  console.log('')

  for (let a = 0; a < plans.length && !stopping; a += 1) {
    const { acc, days } = plans[a]
    const label = acc.account_name || acc.company_token
    console.log(`\n=== Account ${a + 1}/${plans.length}: ${label} (${acc.company_token}) — ${fmtInt(days.length)} days ===`)

    for (let d = 0; d < days.length && !stopping; d += 1) {
      const day = days[d]
      let result = null
      try {
        result = await syncComboFactsForDay(acc.company_id, acc.company_token, acc.public_api_key, day)
      } catch (err) {
        console.error(`  ❌ ${acc.company_token} ${day}: ${err.message}`)
      }

      if (result) {
        totals.listed += result.listed || 0
        totals.fetched += result.fetched || 0
        totals.skipped += result.skipped || 0
        totals.cancelled += result.cancelled || 0
        totals.errors += result.errors || 0
        if (result.errors > 0) daysWithErrors += 1
      }
      doneDays += 1

      // Live progress line.
      const pct = (doneDays / totalAccountDays) * 100
      const elapsed = Date.now() - startedAt
      const perDay = elapsed / doneDays
      const eta = perDay * (totalAccountDays - doneDays)
      const rate = totals.fetched / Math.max(1, elapsed / 60000)
      process.stdout.write(
        `  ${bar(pct)} ${pct.toFixed(1)}% | day ${fmtInt(doneDays)}/${fmtInt(totalAccountDays)} | ` +
        `${day} listed=${result?.listed ?? '-'} fetched=${result?.fetched ?? '-'} skipped=${result?.skipped ?? '-'} err=${result?.errors ?? '-'} | ` +
        `Σfetched=${fmtInt(totals.fetched)} @${rate.toFixed(1)}/min | elapsed ${fmtDuration(elapsed)} | ETA ~${fmtDuration(eta)}\n`
      )

      // Extra cooldown after an error-heavy day (likely rate-limited) to back off.
      if (result && result.errors > 0) {
        console.log('  ⏳ errors this day — cooling down 10s before continuing…')
        await new Promise((r) => setTimeout(r, 10_000))
      }
    }
  }

  printSummary(stopping ? 'STOPPED (resumable)' : 'DONE')
  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌ Fatal:', err)
  try { await pool.end() } catch { /* noop */ }
  process.exit(1)
})
