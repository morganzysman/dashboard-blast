#!/usr/bin/env node

/**
 * Evaluate the achievements trophy case for every company across all stored
 * history (2026-01 → current month) and persist any newly-reached goals.
 *
 * This is the same logic the daily cron and the on-boot backfill run, exposed
 * as a one-off command so achievements can be (re)computed on demand without
 * restarting the server.
 *
 * Safety:
 *   - INSERT ... ON CONFLICT DO NOTHING only. No updates, no deletes.
 *   - Fully idempotent — re-running records nothing new once caught up.
 *   - Reads from the precomputed daily_gains table (no OlaClick API calls).
 *
 * Usage:
 *   node server/scripts/evaluate-achievements.js              # all history
 *   node server/scripts/evaluate-achievements.js 2026-05      # from a month
 *
 * Connection: uses the same env as the server (DATABASE_URL, or DB_HOST/…).
 */

import { pool, runMigrations } from '../database.js'
import { backfillAllAchievements } from '../services/achievementService.js'

const startMonth = process.argv[2] && /^\d{4}-\d{2}$/.test(process.argv[2])
  ? process.argv[2]
  : '2026-01'

async function main() {
  console.log(`🏆 Evaluating achievements from ${startMonth} → now...`)

  // Ensure the achievements_unlocked table exists before evaluating.
  await runMigrations()

  const started = Date.now()
  const unlocked = await backfillAllAchievements(startMonth)
  const secs = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`🏆 Done in ${secs}s — ${unlocked} new unlock(s) recorded.`)
}

main()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('❌ Achievements evaluation failed:', err.message)
    try { await pool.end() } catch { /* ignore */ }
    process.exit(1)
  })
