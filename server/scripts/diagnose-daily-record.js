#!/usr/bin/env node

/**
 * Diagnose the "record to beat" (Meta de hoy) for a given weekday.
 *
 * Read-only against daily_gains, plus an OPTIONAL live OlaClick re-fetch so we
 * can tell the three cases apart when a record looks too low:
 *
 *   1. MISSING  — no daily_gains row for that (account, Saturday). The
 *                 record falls back to an older, lower day.
 *   2. STALE    — a row exists but its stored gross_revenue is lower than what
 *                 OlaClick returns live now (a mid-day snapshot that never got
 *                 finalized).
 *   3. CORRECT  — the stored value matches live; the record is genuinely the
 *                 best stored day and any higher number you saw came from a
 *                 different metric (e.g. OlaClick's own dashboard / cancelled).
 *
 * Usage:
 *   node server/scripts/diagnose-daily-record.js [--date=YYYY-MM-DD] [--account=<substring>] [--live]
 *
 *   --date     Target day whose weekday defines the record (default: today Lima).
 *   --account  Only show accounts whose token/name contains this substring
 *              (e.g. --account=barranco). Default: all accounts.
 *   --live     Also re-fetch each same-weekday day from OlaClick and compare to
 *              the stored value (slower; ~2s per (account, day)).
 *
 * Safety: SELECT-only against the DB. --live performs read-only OlaClick GETs.
 */

import { pool } from '../database.js'
import { fetchOlaClickData } from '../services/olaClickService.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseArgs() {
  const args = { date: null, account: null, live: false }
  for (const raw of process.argv.slice(2)) {
    if (raw === '--live') args.live = true
    else if (raw.startsWith('--date=')) args.date = raw.slice('--date='.length)
    else if (raw.startsWith('--account=')) args.account = raw.slice('--account='.length).toLowerCase()
  }
  return args
}

async function main() {
  const { date: dateArg, account: accountFilter, live } = parseArgs()

  // Resolve target date (defaults to today in Lima) and the 3-month window,
  // mirroring the /daily-record endpoint exactly.
  const winRes = await pool.query(
    `
    WITH d AS (
      SELECT COALESCE($1::date, (now() AT TIME ZONE 'America/Lima')::date) AS target
    )
    SELECT
      to_char(target, 'YYYY-MM-DD') AS target,
      to_char((target - INTERVAL '3 months')::date, 'YYYY-MM-DD') AS win_start,
      to_char((target - INTERVAL '1 day')::date, 'YYYY-MM-DD') AS win_end,
      trim(to_char(target, 'Day')) AS weekday_name,
      EXTRACT(DOW FROM target)::int AS dow
    FROM d
    `,
    [dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : null]
  )
  const { target, win_start: winStart, win_end: winEnd, weekday_name: weekday, dow } = winRes.rows[0]

  console.log('────────────────────────────────────────────────────────────')
  console.log(`📊 Daily-record diagnosis`)
  console.log(`   Target day : ${target} (${weekday}, DOW=${dow})`)
  console.log(`   Window     : ${winStart} → ${winEnd} (same-weekday only)`)
  if (accountFilter) console.log(`   Account    : filter="${accountFilter}"`)
  console.log(`   Live check : ${live ? 'ON (comparing stored vs OlaClick)' : 'off'}`)
  console.log('────────────────────────────────────────────────────────────')

  // Every stored same-weekday row in the window, per account.
  const rowsRes = await pool.query(
    `
    SELECT dg.company_id,
           dg.company_token,
           ca.account_name,
           ca.api_token,
           to_char(dg.date, 'YYYY-MM-DD') AS date,
           dg.gross_revenue::float8 AS gross,
           to_char(dg.computed_at, 'YYYY-MM-DD HH24:MI') AS computed_at
    FROM daily_gains dg
    LEFT JOIN company_accounts ca
      ON ca.company_id = dg.company_id AND ca.company_token = dg.company_token
    WHERE dg.date >= $1 AND dg.date <= $2
      AND EXTRACT(DOW FROM dg.date) = $3
    ORDER BY dg.company_token, dg.date
    `,
    [winStart, winEnd, dow]
  )

  // Group by account.
  const byAccount = new Map()
  for (const r of rowsRes.rows) {
    const name = (r.account_name || r.company_token || '').toLowerCase()
    if (accountFilter && !name.includes(accountFilter) && !r.company_token.toLowerCase().includes(accountFilter)) {
      continue
    }
    if (!byAccount.has(r.company_token)) {
      byAccount.set(r.company_token, {
        token: r.company_token,
        name: r.account_name || r.company_token,
        companyId: r.company_id,
        apiToken: r.api_token,
        rows: []
      })
    }
    byAccount.get(r.company_token).rows.push(r)
  }

  if (byAccount.size === 0) {
    console.log('⚠️  No stored same-weekday rows found for the filter/window.')
    await pool.end()
    process.exit(0)
  }

  for (const acc of byAccount.values()) {
    // Enumerate every same-weekday calendar date in the window so we can flag
    // MISSING days (not just the ones that have rows).
    const allWeekdayDatesRes = await pool.query(
      `
      SELECT to_char(gs::date, 'YYYY-MM-DD') AS date
      FROM generate_series($1::date, $2::date, INTERVAL '1 day') gs
      WHERE EXTRACT(DOW FROM gs) = $3
      ORDER BY gs
      `,
      [winStart, winEnd, dow]
    )
    const allDates = allWeekdayDatesRes.rows.map((r) => r.date)
    const storedByDate = new Map(acc.rows.map((r) => [r.date, r]))

    // Current record the endpoint would pick = max stored gross.
    const best = acc.rows.reduce(
      (m, r) => (r.gross > (m?.gross ?? -1) ? r : m),
      null
    )

    console.log('')
    console.log(`▶ ${acc.name}  (${acc.token})`)
    console.log(
      `   Record the app shows: ${best ? `S/ ${best.gross.toFixed(2)} on ${best.date}` : '— (no rows)'}`
    )
    console.log(`   Same-weekday days in window: ${allDates.length}, stored: ${acc.rows.length}, missing: ${allDates.length - acc.rows.length}`)
    console.log('   date        stored_gross   computed_at        status')

    for (const d of allDates) {
      const row = storedByDate.get(d)
      let liveGross = null
      if (live && acc.apiToken) {
        try {
          const res = await fetchOlaClickData(
            { company_token: acc.token, api_token: acc.apiToken },
            { 'filter[start_date]': d, 'filter[end_date]': d, 'filter[timezone]': 'America/Lima' }
          )
          if (res.success && Array.isArray(res.data?.data)) {
            liveGross = res.data.data.reduce((s, m) => s + (Number(m.sum) || 0), 0)
          }
        } catch {
          liveGross = null
        }
        await sleep(2000)
      }

      if (!row) {
        const liveStr = liveGross != null ? `  live=S/ ${liveGross.toFixed(2)}` : ''
        console.log(`   ${d}   ${'—'.padStart(12)}   ${'—'.padEnd(16)}   MISSING${liveStr}`)
        continue
      }

      let status = 'stored'
      let liveStr = ''
      if (liveGross != null) {
        const diff = liveGross - row.gross
        liveStr = `  live=S/ ${liveGross.toFixed(2)}`
        if (Math.abs(diff) < 0.005) status = 'CORRECT (matches live)'
        else if (diff > 0) status = `STALE (live is S/ ${diff.toFixed(2)} higher)`
        else status = `stored higher than live by S/ ${(-diff).toFixed(2)}`
      }
      console.log(
        `   ${d}   S/ ${row.gross.toFixed(2).padStart(9)}   ${(row.computed_at || '—').padEnd(16)}   ${status}${liveStr}`
      )
    }
  }

  console.log('')
  console.log('────────────────────────────────────────────────────────────')
  console.log('Interpretation:')
  console.log('  • A MISSING row on a high-selling weekday  → backfill gap (fixed in autoBackfillIfNeeded).')
  console.log('  • A STALE row (live higher than stored)     → re-run backfill for that day/window.')
  console.log('  • All CORRECT and record still looks low    → the higher number came from a different metric.')
  await pool.end()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌ Diagnosis failed:', err)
  try {
    await pool.end()
  } catch {
    // pool already closed
  }
  process.exit(1)
})
