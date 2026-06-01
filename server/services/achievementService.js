import cron from 'node-cron'
import { pool } from '../database.js'

// ── Calibration constants (mirror client/src/composables/useAchievements.js) ──
const DAILY_GAIN_OBJECTIVE = 2000 // account-level daily net-gain objective
const COMPANY_DAILY_GAIN_GOAL = 2000 // combined daily net-gain goal
const COMPANY_DAILY_GAIN_STRETCH = 3500 // EOY combined daily stretch
const MONTHLY_SALES_BRONZE_PER_LOCATION = 50000 // S/ 50k/store → S/ 100k @ 2 stores

/**
 * Blast achievement catalog. IDs are stable and must match the client renderer.
 * Evaluation runs server-side against the stored daily_gains table; reached
 * goals are persisted to achievements_unlocked (a permanent trophy case).
 */
export const ACHIEVEMENT_DEFINITIONS = [
  // ── Account · Daily · Sales ──
  { id: 'acc-d-sales-2k', scope: 'account', period: 'daily', category: 'sales', icon: '🔔', metric: 'gross_revenue', target: 2000, tier: 'bronze' },
  { id: 'acc-d-sales-25k', scope: 'account', period: 'daily', category: 'sales', icon: '💵', metric: 'gross_revenue', target: 2500, tier: 'silver' },
  { id: 'acc-d-sales-35k', scope: 'account', period: 'daily', category: 'sales', icon: '🎉', metric: 'gross_revenue', target: 3500, tier: 'gold' },
  { id: 'acc-d-sales-45k', scope: 'account', period: 'daily', category: 'sales', icon: '🏆', metric: 'gross_revenue', target: 4500, tier: 'platinum' },

  // ── Account · Daily · Profit ──
  { id: 'acc-d-profit-positive', scope: 'account', period: 'daily', category: 'profit', icon: '✅', metric: 'net_gain', target: 1, tier: 'bronze' },
  { id: 'acc-d-profit-goal', scope: 'account', period: 'daily', category: 'profit', icon: '🎯', metric: 'net_gain', target: DAILY_GAIN_OBJECTIVE, tier: 'gold' },
  { id: 'acc-d-profit-super', scope: 'account', period: 'daily', category: 'profit', icon: '🚀', metric: 'net_gain', target: 3000, tier: 'platinum' },

  // ── Account · Daily · Orders ──
  { id: 'acc-d-orders-20', scope: 'account', period: 'daily', category: 'orders', icon: '📦', metric: 'orders_count', target: 20, tier: 'bronze' },
  { id: 'acc-d-orders-40', scope: 'account', period: 'daily', category: 'orders', icon: '🔥', metric: 'orders_count', target: 40, tier: 'silver' },
  { id: 'acc-d-orders-60', scope: 'account', period: 'daily', category: 'orders', icon: '⚡', metric: 'orders_count', target: 60, tier: 'gold' },

  // ── Account · Monthly · Sales ──
  { id: 'acc-m-sales-50k', scope: 'account', period: 'monthly', category: 'sales', icon: '📈', metric: 'gross_revenue', target: 50000, tier: 'bronze' },
  { id: 'acc-m-sales-65k', scope: 'account', period: 'monthly', category: 'sales', icon: '📊', metric: 'gross_revenue', target: 65000, tier: 'silver' },
  { id: 'acc-m-sales-80k', scope: 'account', period: 'monthly', category: 'sales', icon: '🛒', metric: 'gross_revenue', target: 80000, tier: 'gold' },
  { id: 'acc-m-sales-100k', scope: 'account', period: 'monthly', category: 'sales', icon: '👑', metric: 'gross_revenue', target: 100000, tier: 'platinum' },

  // ── Account · Monthly · Profit ──
  { id: 'acc-m-profit-5k', scope: 'account', period: 'monthly', category: 'profit', icon: '💎', metric: 'net_gain', target: 5000, tier: 'silver' },
  { id: 'acc-m-profit-12k', scope: 'account', period: 'monthly', category: 'profit', icon: '🌟', metric: 'net_gain', target: 12000, tier: 'gold' },
  { id: 'acc-m-profit-goal', scope: 'account', period: 'monthly', category: 'profit', icon: '🎯', metric: 'net_gain', targetKey: 'monthly_gain_objective', tier: 'platinum' },

  // ── Account · Monthly · Streaks ──
  { id: 'acc-m-streak-profit-5', scope: 'account', period: 'monthly', category: 'streak', icon: '🔗', streakType: 'profitable_days', streakLength: 5, tier: 'silver' },
  { id: 'acc-m-streak-goal-3', scope: 'account', period: 'monthly', category: 'streak', icon: '📅', streakType: 'objective_days', streakLength: 3, tier: 'gold' },
  { id: 'acc-m-streak-goal-7', scope: 'account', period: 'monthly', category: 'streak', icon: '🗓️', streakType: 'objective_days', streakLength: 7, tier: 'platinum' },

  // ── Company · Daily · Sales (scaled per operating location that day) ──
  { id: 'co-d-sales-3k', scope: 'company', period: 'daily', category: 'sales', icon: '🏢', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 1500, tier: 'bronze' },
  { id: 'co-d-sales-4k', scope: 'company', period: 'daily', category: 'sales', icon: '🌐', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 2000, tier: 'silver' },
  { id: 'co-d-sales-5k', scope: 'company', period: 'daily', category: 'sales', icon: '🎊', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 2500, tier: 'gold' },
  { id: 'co-d-sales-7k', scope: 'company', period: 'daily', category: 'sales', icon: '🛰️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 3500, tier: 'platinum' },

  // ── Company · Daily · Profit (fixed combined net gain) ──
  { id: 'co-d-profit-positive', scope: 'company', period: 'daily', category: 'profit', icon: '✨', metric: 'net_gain', target: 1, tier: 'bronze' },
  { id: 'co-d-profit-goal', scope: 'company', period: 'daily', category: 'profit', icon: '🎯', metric: 'net_gain', target: COMPANY_DAILY_GAIN_GOAL, tier: 'gold' },
  { id: 'co-d-profit-stretch', scope: 'company', period: 'daily', category: 'profit', icon: '🚀', metric: 'net_gain', target: COMPANY_DAILY_GAIN_STRETCH, tier: 'platinum' },

  // ── Company · Daily · Team ──
  { id: 'co-d-all-profitable', scope: 'company', period: 'daily', category: 'team', icon: '🤝', teamType: 'all_profitable', tier: 'gold' },

  // ── Company · Monthly · Sales (scaled per active location) ──
  { id: 'co-m-sales-100k', scope: 'company', period: 'monthly', category: 'sales', icon: '🏛️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: MONTHLY_SALES_BRONZE_PER_LOCATION, tier: 'bronze' },
  { id: 'co-m-sales-125k', scope: 'company', period: 'monthly', category: 'sales', icon: '🏗️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 62500, tier: 'silver' },
  { id: 'co-m-sales-150k', scope: 'company', period: 'monthly', category: 'sales', icon: '🎖️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 75000, tier: 'gold' },
  { id: 'co-m-sales-180k', scope: 'company', period: 'monthly', category: 'sales', icon: '💫', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 90000, tier: 'platinum' },

  // ── Company · Monthly · Profit (combined) ──
  { id: 'co-m-profit-15k', scope: 'company', period: 'monthly', category: 'profit', icon: '💼', metric: 'net_gain', targetKey: 'company_monthly_gain_floor', tier: 'silver' },
  { id: 'co-m-profit-30k', scope: 'company', period: 'monthly', category: 'profit', icon: '🏅', metric: 'net_gain', targetKey: 'company_monthly_gain_mid', tier: 'gold' },
  { id: 'co-m-profit-goal', scope: 'company', period: 'monthly', category: 'profit', icon: '🎯', metric: 'net_gain', targetKey: 'company_monthly_gain_objective', tier: 'platinum' },

  // ── Company · Monthly · Team ──
  { id: 'co-m-all-goal-day', scope: 'company', period: 'monthly', category: 'team', icon: '🤝', teamType: 'all_hit_objective_day', tier: 'platinum' }
]

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Resolve a definition's numeric target given a context.
 *  - accountCount: locations to scale company_per_location by
 *  - daysWithData: days the account reported (account monthly objective)
 *  - companyDaysWithData: days the company reported (company monthly objective)
 */
function resolveTarget(def, context = {}) {
  switch (def.targetKey) {
    case 'monthly_gain_objective':
      return DAILY_GAIN_OBJECTIVE * (context.daysWithData || 1)
    case 'company_per_location':
      return def.targetPerLocation * Math.max(1, context.accountCount || 1)
    case 'company_monthly_gain_floor':
      return 15000
    case 'company_monthly_gain_mid':
      return 30000
    case 'company_monthly_gain_objective':
      return COMPANY_DAILY_GAIN_GOAL * (context.companyDaysWithData || 1)
    default:
      return def.target ?? 0
  }
}

function maxStreak(rows, predicate) {
  const sorted = [...rows].filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date))
  let best = 0
  let current = 0
  for (const row of sorted) {
    if (predicate(row)) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

// ── Data access ──────────────────────────────────────────────────────────────

function monthBounds(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const start = `${monthKey}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]
  return { start, end }
}

async function fetchMonthRows(companyId, monthKey) {
  const { start, end } = monthBounds(monthKey)
  const res = await pool.query(
    `SELECT company_token,
            to_char(date, 'YYYY-MM-DD') AS date,
            gross_revenue, net_gain, orders_count
       FROM daily_gains
      WHERE company_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date`,
    [companyId, start, end]
  )
  return res.rows
}

async function fetchFirstDateByToken(companyId) {
  const res = await pool.query(
    `SELECT company_token, to_char(MIN(date), 'YYYY-MM-DD') AS first_date
       FROM daily_gains WHERE company_id = $1 GROUP BY company_token`,
    [companyId]
  )
  const map = {}
  res.rows.forEach((r) => { map[r.company_token] = r.first_date })
  return map
}

async function fetchRegisteredTokens(companyId) {
  const res = await pool.query(
    'SELECT company_token FROM company_accounts WHERE company_id = $1',
    [companyId]
  )
  return res.rows.map((r) => r.company_token).filter(Boolean)
}

// ── Evaluation ────────────────────────────────────────────────────────────────

const DEFS_ACC_DAILY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'account' && d.period === 'daily' && d.metric)
const DEFS_ACC_MONTHLY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'account' && d.period === 'monthly' && d.metric)
const DEFS_ACC_STREAK = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'account' && d.streakType)
const DEFS_CO_DAILY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'company' && d.period === 'daily' && d.metric)
const DEFS_CO_MONTHLY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'company' && d.period === 'monthly' && d.metric)
const DEFS_CO_TEAM_DAILY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'company' && d.teamType && d.period === 'daily')
const DEFS_CO_TEAM_MONTHLY = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === 'company' && d.teamType && d.period === 'monthly')

/**
 * Evaluate every goal for one company in one month against stored daily_gains
 * and return the list of unlock records that were reached. Pure given inputs.
 */
function computeUnlocks(monthKey, rows, registeredTokens, firstDateByToken) {
  const unlocks = []
  const push = (scope, token, def, periodKey, value) =>
    unlocks.push({ scope, company_token: token, achievement_id: def.id, period: def.period, period_key: periodKey, unlock_value: num(value) })

  // Group rows
  const byToken = new Map() // token -> rows[]
  const byDate = new Map() // date -> rows[]
  for (const r of rows) {
    if (!byToken.has(r.company_token)) byToken.set(r.company_token, [])
    byToken.get(r.company_token).push(r)
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date).push(r)
  }

  const monthTokens = [...byToken.keys()]
  const activeCount = monthTokens.length

  // ── Account · daily ──
  for (const [token, tokenRows] of byToken) {
    for (const row of tokenRows) {
      for (const def of DEFS_ACC_DAILY) {
        if (num(row[def.metric]) >= resolveTarget(def)) push('account', token, def, row.date, row[def.metric])
      }
    }
  }

  // ── Account · monthly (sum) + streaks ──
  for (const [token, tokenRows] of byToken) {
    const daysWithData = tokenRows.length || 1
    const totals = tokenRows.reduce(
      (a, r) => ({ gross_revenue: a.gross_revenue + num(r.gross_revenue), net_gain: a.net_gain + num(r.net_gain), orders_count: a.orders_count + num(r.orders_count) }),
      { gross_revenue: 0, net_gain: 0, orders_count: 0 }
    )
    for (const def of DEFS_ACC_MONTHLY) {
      if (num(totals[def.metric]) >= resolveTarget(def, { daysWithData })) push('account', token, def, monthKey, totals[def.metric])
    }
    for (const def of DEFS_ACC_STREAK) {
      const len = def.streakType === 'profitable_days'
        ? maxStreak(tokenRows, (r) => num(r.net_gain) > 0)
        : maxStreak(tokenRows, (r) => num(r.net_gain) >= DAILY_GAIN_OBJECTIVE)
      if (len >= def.streakLength) push('account', token, def, monthKey, len)
    }
  }

  // ── Company · daily (aggregate per date) ──
  for (const [date, dayRows] of byDate) {
    const operatingCount = dayRows.length
    const agg = dayRows.reduce(
      (a, r) => ({ gross_revenue: a.gross_revenue + num(r.gross_revenue), net_gain: a.net_gain + num(r.net_gain), orders_count: a.orders_count + num(r.orders_count) }),
      { gross_revenue: 0, net_gain: 0, orders_count: 0 }
    )
    for (const def of DEFS_CO_DAILY) {
      if (num(agg[def.metric]) >= resolveTarget(def, { accountCount: operatingCount })) push('company', '', def, date, agg[def.metric])
    }
    // Team · daily — all locations operating by this date reported and are green
    for (const def of DEFS_CO_TEAM_DAILY) {
      if (def.teamType !== 'all_profitable') continue
      const operating = registeredTokens.filter((t) => firstDateByToken[t] && firstDateByToken[t] <= date)
      if (!operating.length) continue
      const present = new Set(dayRows.map((r) => r.company_token))
      const allReported = operating.every((t) => present.has(t))
      const allGreen = dayRows.filter((r) => operating.includes(r.company_token)).every((r) => num(r.net_gain) > 0)
      if (allReported && allGreen) push('company', '', def, date, agg.net_gain)
    }
  }

  // ── Company · monthly (sum) ──
  const companyDaysWithData = byDate.size || 1
  const companyTotals = rows.reduce(
    (a, r) => ({ gross_revenue: a.gross_revenue + num(r.gross_revenue), net_gain: a.net_gain + num(r.net_gain), orders_count: a.orders_count + num(r.orders_count) }),
    { gross_revenue: 0, net_gain: 0, orders_count: 0 }
  )
  for (const def of DEFS_CO_MONTHLY) {
    const target = resolveTarget(def, { accountCount: activeCount, companyDaysWithData })
    if (num(companyTotals[def.metric]) >= target) push('company', '', def, monthKey, companyTotals[def.metric])
  }

  // ── Company · monthly team — any single day where all operating locations hit objective ──
  for (const def of DEFS_CO_TEAM_MONTHLY) {
    if (def.teamType !== 'all_hit_objective_day') continue
    for (const [date, dayRows] of byDate) {
      const operating = registeredTokens.filter((t) => firstDateByToken[t] && firstDateByToken[t] <= date)
      if (!operating.length) continue
      const byTok = new Map(dayRows.map((r) => [r.company_token, r]))
      const allReported = operating.every((t) => byTok.has(t))
      const allHit = operating.every((t) => num(byTok.get(t)?.net_gain) >= DAILY_GAIN_OBJECTIVE)
      if (allReported && allHit) { push('company', '', def, monthKey, operating.length); break }
    }
  }

  return unlocks
}

async function persistUnlocks(companyId, unlocks) {
  if (!unlocks.length) return 0
  let inserted = 0
  const CHUNK = 100
  for (let i = 0; i < unlocks.length; i += CHUNK) {
    const slice = unlocks.slice(i, i + CHUNK)
    const values = []
    const params = []
    slice.forEach((u, idx) => {
      const b = idx * 6
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`)
      params.push(companyId, u.scope, u.company_token, u.achievement_id, u.period_key, u.unlock_value)
    })
    const res = await pool.query(
      `INSERT INTO achievements_unlocked (company_id, scope, company_token, achievement_id, period_key, unlock_value)
       VALUES ${values.join(', ')}
       ON CONFLICT (company_id, scope, company_token, achievement_id, period_key) DO NOTHING`,
      params
    )
    inserted += res.rowCount || 0
  }
  return inserted
}

/** Evaluate + persist for one company across the given months. */
export async function evaluateCompanyMonths(companyId, monthKeys) {
  const registeredTokens = await fetchRegisteredTokens(companyId)
  const firstDateByToken = await fetchFirstDateByToken(companyId)
  let total = 0
  for (const monthKey of monthKeys) {
    const rows = await fetchMonthRows(companyId, monthKey)
    if (!rows.length) continue
    const unlocks = computeUnlocks(monthKey, rows, registeredTokens, firstDateByToken)
    total += await persistUnlocks(companyId, unlocks)
  }
  return total
}

function monthKeysSince(startMonth) {
  const keys = []
  const [sy, sm] = startMonth.split('-').map(Number)
  const now = new Date()
  let y = sy
  let m = sm
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return keys
}

function currentAndPreviousMonthKeys() {
  const now = new Date()
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  return [prev, cur]
}

// ── Public read API ────────────────────────────────────────────────────────────

/**
 * Build the badge list for a scope. Each badge carries its definition, whether
 * it has ever been earned (with first date + times), and live progress for the
 * current period (today for daily goals, month-to-date for monthly goals).
 */
export async function getBadges(companyId, scope, companyToken = null) {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Resolve company timezone for "today"
  const tzRes = await pool.query('SELECT timezone FROM companies WHERE id = $1', [companyId])
  const tz = tzRes.rows[0]?.timezone || 'America/Lima'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  const defs = ACHIEVEMENT_DEFINITIONS.filter((d) => d.scope === scope)
  const tokenKey = scope === 'company' ? '' : companyToken

  // Unlock summary for this scope/token
  const unlockRes = await pool.query(
    `SELECT achievement_id,
            COUNT(*)::int AS times,
            MIN(unlocked_at) AS first_at,
            MAX(period_key) AS last_period
       FROM achievements_unlocked
      WHERE company_id = $1 AND scope = $2 AND company_token = $3
      GROUP BY achievement_id`,
    [companyId, scope, tokenKey || '']
  )
  const unlockMap = new Map(unlockRes.rows.map((r) => [r.achievement_id, r]))

  // Live current-period rows
  const monthRows = await fetchMonthRows(companyId, monthKey)
  const scopedMonthRows = scope === 'company'
    ? monthRows
    : monthRows.filter((r) => r.company_token === companyToken)

  // Aggregate helpers for current period
  const sum = (rws, metric) => rws.reduce((a, r) => a + num(r[metric]), 0)
  const todayRows = scopedMonthRows.filter((r) => r.date === today)

  const activeCount = scope === 'company' ? new Set(monthRows.map((r) => r.company_token)).size : 1
  const operatingToday = scope === 'company' ? new Set(todayRows.map((r) => r.company_token)).size : 1
  const daysWithData = scope === 'company'
    ? new Set(monthRows.map((r) => r.date)).size || 1
    : new Set(scopedMonthRows.map((r) => r.date)).size || 1

  return defs.map((def) => {
    const u = unlockMap.get(def.id)
    const badge = {
      id: def.id,
      scope: def.scope,
      period: def.period,
      category: def.category,
      tier: def.tier,
      icon: def.icon,
      metric: def.metric || null,
      streakType: def.streakType || null,
      streakLength: def.streakLength || null,
      teamType: def.teamType || null,
      unlocked: !!u,
      timesEarned: u ? u.times : 0,
      unlockedAt: u ? u.first_at : null,
      lastPeriodKey: u ? u.last_period : null,
      target: null,
      current: null,
      progress: null
    }

    if (def.streakType || def.teamType) {
      return badge // no live progress bar for streak/team goals
    }

    // Resolve target + current for the live period
    if (def.period === 'daily') {
      badge.target = resolveTarget(def, { accountCount: operatingToday })
      badge.current = sum(todayRows, def.metric)
    } else {
      badge.target = resolveTarget(def, { accountCount: activeCount, daysWithData, companyDaysWithData: daysWithData })
      badge.current = sum(scopedMonthRows, def.metric)
    }
    badge.progress = badge.target > 0 ? Math.min(100, Math.max(0, (badge.current / badge.target) * 100)) : 0
    return badge
  })
}

// ── Cron + boot backfill ─────────────────────────────────────────────────────

async function evaluateAllCompanies(monthKeys) {
  const companies = await pool.query('SELECT id FROM companies')
  let total = 0
  for (const c of companies.rows) {
    try {
      total += await evaluateCompanyMonths(c.id, monthKeys)
    } catch (err) {
      console.error(`  ❌ Achievements eval failed for company ${c.id}:`, err.message)
    }
  }
  return total
}

/** Daily cron — re-evaluate current + previous month after gains are finalized. */
export function scheduleAchievementsCron() {
  // 4 AM Lima — runs after the 3 AM daily-gains finalization.
  cron.schedule('0 4 * * *', async () => {
    console.log('🏆 [Cron] Evaluating achievements...')
    try {
      const newly = await evaluateAllCompanies(currentAndPreviousMonthKeys())
      console.log(`🏆 [Cron] Achievements evaluated — ${newly} new unlock(s)`)
    } catch (err) {
      console.error('❌ [Cron] Achievements error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  // Mid-day refresh so goals reached during the day light up without waiting.
  cron.schedule('30 13,20 * * *', async () => {
    try {
      const newly = await evaluateAllCompanies(currentAndPreviousMonthKeys())
      if (newly > 0) console.log(`🏆 [Cron] Midday achievements — ${newly} new unlock(s)`)
    } catch (err) {
      console.error('❌ [Cron] Midday achievements error:', err.message)
    }
  }, { timezone: 'America/Lima' })

  console.log('🏆 Achievements cron scheduled (4 AM + midday refresh)')
}

/** On boot, populate the trophy case from all stored history (non-blocking). */
export async function autoEvaluateAchievementsOnBoot() {
  try {
    const months = monthKeysSince('2026-01')
    evaluateAllCompanies(months)
      .then((n) => console.log(`🏆 Achievements boot backfill complete — ${n} unlock(s) recorded across ${months.length} month(s)`))
      .catch((err) => console.error('❌ Achievements boot backfill error:', err.message))
  } catch (err) {
    console.log('🏆 Achievements table not ready, skipping boot backfill')
  }
}
