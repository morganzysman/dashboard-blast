import { DAILY_GAIN_OBJECTIVE } from './useProfitability'

/** Company-wide daily net gain targets (Blast baseline, all stores combined). */
export const COMPANY_DAILY_GAIN_GOAL = 2000
/** End-of-year stretch target for combined daily net gain. */
export const COMPANY_DAILY_GAIN_STRETCH = 3500

/** Monthly sales per location — S/ 50k × 2 stores = S/ 100k company bronze. */
export const MONTHLY_SALES_BRONZE_PER_LOCATION = 50000

/** @typedef {'account'|'company'} AchievementScope */
/** @typedef {'daily'|'monthly'} AchievementPeriod */
/** @typedef {'sales'|'profit'|'orders'|'streak'|'team'} AchievementCategory */

/**
 * Blast achievement catalog — calibrated to current performance (~2 stores,
 * ~S/ 100k/month company sales, ~S/ 5k combined on a great sales day).
 * Company sales scale per location; company daily profit uses fixed combined targets.
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

  // ── Account · Monthly · Sales (S/ 50k/store → S/ 100k company @ 2 stores) ──
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

  // ── Company · Daily · Sales (S/ 2.5k/store × n → S/ 5k gold @ 2 stores on a great day) ──
  { id: 'co-d-sales-3k', scope: 'company', period: 'daily', category: 'sales', icon: '🏢', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 1500, tier: 'bronze' },
  { id: 'co-d-sales-4k', scope: 'company', period: 'daily', category: 'sales', icon: '🌐', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 2000, tier: 'silver' },
  { id: 'co-d-sales-5k', scope: 'company', period: 'daily', category: 'sales', icon: '🎊', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 2500, tier: 'gold' },
  { id: 'co-d-sales-7k', scope: 'company', period: 'daily', category: 'sales', icon: '🛰️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 3500, tier: 'platinum' },

  // ── Company · Daily · Profit (fixed combined net gain — not per store) ──
  { id: 'co-d-profit-positive', scope: 'company', period: 'daily', category: 'profit', icon: '✨', metric: 'net_gain', target: 1, tier: 'bronze' },
  { id: 'co-d-profit-goal', scope: 'company', period: 'daily', category: 'profit', icon: '🎯', metric: 'net_gain', target: COMPANY_DAILY_GAIN_GOAL, tier: 'gold' },
  { id: 'co-d-profit-stretch', scope: 'company', period: 'daily', category: 'profit', icon: '🚀', metric: 'net_gain', target: COMPANY_DAILY_GAIN_STRETCH, tier: 'platinum' },

  // ── Company · Daily · Team ──
  { id: 'co-d-all-profitable', scope: 'company', period: 'daily', category: 'team', icon: '🤝', teamType: 'all_profitable', tier: 'gold' },

  // ── Company · Monthly · Sales (S/ 50k/store × n → S/ 100k bronze @ 2 stores) ──
  { id: 'co-m-sales-100k', scope: 'company', period: 'monthly', category: 'sales', icon: '🏛️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: MONTHLY_SALES_BRONZE_PER_LOCATION, tier: 'bronze' },
  { id: 'co-m-sales-125k', scope: 'company', period: 'monthly', category: 'sales', icon: '🏗️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 62500, tier: 'silver' },
  { id: 'co-m-sales-150k', scope: 'company', period: 'monthly', category: 'sales', icon: '🎖️', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 75000, tier: 'gold' },
  { id: 'co-m-sales-180k', scope: 'company', period: 'monthly', category: 'sales', icon: '💫', metric: 'gross_revenue', targetKey: 'company_per_location', targetPerLocation: 90000, tier: 'platinum' },

  // ── Company · Monthly · Profit (combined; scaled from S/ 2k/day company goal) ──
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

export function sumMetrics(rows) {
  return rows.reduce(
    (acc, row) => ({
      gross_revenue: acc.gross_revenue + num(row.gross_revenue),
      net_gain: acc.net_gain + num(row.net_gain),
      orders_count: acc.orders_count + num(row.orders_count)
    }),
    { gross_revenue: 0, net_gain: 0, orders_count: 0 }
  )
}

export function filterRowsByDate(rows, dateStr) {
  return rows.filter((row) => {
    const d = typeof row.date === 'string' ? row.date.split('T')[0] : row.date
    return d === dateStr
  })
}

export function countDaysWithData(rows) {
  const dates = new Set()
  for (const row of rows) {
    if (row.date) dates.add(typeof row.date === 'string' ? row.date.split('T')[0] : row.date)
  }
  return dates.size || 1
}

export function rowsForAccount(rows, companyToken) {
  return rows.filter((row) => row.company_token === companyToken)
}

/** Sum of (daily objective × days with data) per registered location — fair when a store opens mid-month. */
export function companyMonthlyGainObjective(allAccountMonthRows, accountTokens) {
  if (!accountTokens.length) return DAILY_GAIN_OBJECTIVE
  let total = 0
  for (const token of accountTokens) {
    total += DAILY_GAIN_OBJECTIVE * countDaysWithData(rowsForAccount(allAccountMonthRows, token))
  }
  return total || DAILY_GAIN_OBJECTIVE
}

/** Combined daily profit target for locations that reported data today. */
export function companyDailyGainObjective(perAccountToday, accountTokens) {
  const reportingToday = new Set(
    perAccountToday.map((row) => row.company_token).filter(Boolean)
  )
  const operatingCount = accountTokens.filter((token) => reportingToday.has(token)).length
  return DAILY_GAIN_OBJECTIVE * Math.max(1, operatingCount)
}

export function scaledByLocationCount(perLocation, accountCount) {
  return perLocation * Math.max(1, accountCount)
}

export function maxStreak(rows, predicate) {
  const sorted = [...rows]
    .map((r) => ({
      date: typeof r.date === 'string' ? r.date.split('T')[0] : r.date,
      row: r
    }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  let best = 0
  let current = 0
  for (const { row } of sorted) {
    if (predicate(row)) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

function resolveTarget(def, context) {
  if (def.targetKey === 'monthly_gain_objective') {
    return DAILY_GAIN_OBJECTIVE * context.daysWithData
  }
  if (def.targetKey === 'company_per_location') {
    return scaledByLocationCount(def.targetPerLocation, context.accountCount)
  }
  if (def.targetKey === 'company_monthly_gain_floor') {
    return 15000
  }
  if (def.targetKey === 'company_monthly_gain_mid') {
    return 30000
  }
  if (def.targetKey === 'company_monthly_gain_objective') {
    const days = context.companyDaysWithData ?? countDaysWithData(context.monthlyRows)
    return COMPANY_DAILY_GAIN_GOAL * days
  }
  return def.target ?? 0
}

function evaluateStreak(def, rows) {
  const length = def.streakLength || 0
  if (def.streakType === 'profitable_days') {
    return maxStreak(rows, (r) => num(r.net_gain) > 0) >= length
  }
  if (def.streakType === 'objective_days') {
    return maxStreak(rows, (r) => num(r.net_gain) >= DAILY_GAIN_OBJECTIVE) >= length
  }
  return false
}

function rowDate(row) {
  if (!row?.date) return null
  return typeof row.date === 'string' ? row.date.split('T')[0] : row.date
}

function firstDataDateByToken(rows, token) {
  const dates = rows
    .filter((row) => row.company_token === token)
    .map((row) => rowDate(row))
    .filter(Boolean)
    .sort()
  return dates[0] || null
}

function tokensOperatingOnDate(rows, accountTokens, date) {
  const reporting = new Set(rows.filter((row) => rowDate(row) === date).map((row) => row.company_token))
  return accountTokens.filter((token) => {
    const firstDay = firstDataDateByToken(rows, token)
    return firstDay && firstDay <= date && reporting.has(token)
  })
}

function evaluateTeam(def, context) {
  const { perAccountToday, perAccountMonth, accountTokens } = context
  const accountCount = accountTokens.length
  if (!accountCount) return false

  if (def.teamType === 'all_profitable') {
    // Every registered location must report today and finish in the green.
    const tokensToday = new Set(perAccountToday.map((r) => r.company_token))
    if (accountTokens.some((token) => !tokensToday.has(token))) return false
    return perAccountToday.every((r) => num(r.net_gain) > 0)
  }

  if (def.teamType === 'all_hit_objective_day') {
    const byDate = new Map()
    for (const row of perAccountMonth) {
      const date = rowDate(row)
      if (!date) continue
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date).push(row)
    }
    for (const [date, dayRows] of byDate) {
      const eligible = tokensOperatingOnDate(perAccountMonth, accountTokens, date)
      if (eligible.length < accountCount) continue
      const byToken = new Map(dayRows.map((row) => [row.company_token, row]))
      if (eligible.every((token) => num(byToken.get(token)?.net_gain) >= DAILY_GAIN_OBJECTIVE)) {
        return true
      }
    }
    return false
  }
  return false
}

/**
 * Evaluate one achievement definition against computed metrics.
 */
export function evaluateAchievement(def, context) {
  const { period, scope } = def
  const rows = period === 'daily' ? context.dailyRows : context.monthlyRows
  const totals = sumMetrics(rows)
  const target = resolveTarget(def, context)

  if (def.streakType) {
    const streakValue =
      def.streakType === 'profitable_days'
        ? maxStreak(context.monthlyRows, (r) => num(r.net_gain) > 0)
        : maxStreak(context.monthlyRows, (r) => num(r.net_gain) >= DAILY_GAIN_OBJECTIVE)
    return {
      unlocked: evaluateStreak(def, context.monthlyRows),
      current: streakValue,
      target: def.streakLength,
      metricLabel: 'streak'
    }
  }

  if (def.teamType) {
    const unlocked = evaluateTeam(def, context)
    return {
      unlocked,
      current: unlocked ? 1 : 0,
      target: 1,
      metricLabel: 'team'
    }
  }

  const current = num(totals[def.metric])
  return {
    unlocked: current >= target,
    current,
    target,
    metricLabel: def.metric
  }
}

export function buildAchievementResults(definitions, context) {
  return definitions.map((def) => {
    const result = evaluateAchievement(def, context)
    const target = resolveTarget(def, context)
    return {
      ...def,
      ...result,
      progress:
        def.streakType || def.teamType
          ? null
          : Math.min(100, target > 0 ? (result.current / target) * 100 : 0)
    }
  })
}

/** Metrics shown as milestone ladders on the simplified achievements page. */
const MILESTONE_GROUPS = [
  { period: 'daily', category: 'sales', metric: 'gross_revenue' },
  { period: 'daily', category: 'profit', metric: 'net_gain' },
  { period: 'monthly', category: 'sales', metric: 'gross_revenue' },
  { period: 'monthly', category: 'profit', metric: 'net_gain' }
]

/**
 * Build ordered milestone tracks for a scope. Each track lists its tiers from
 * lowest to highest target, marks which are already reached, and reports the
 * next target plus progress toward it. This is the "passed and coming up" view.
 */
export function buildMilestoneTracks(scope, context) {
  return MILESTONE_GROUPS.map((g) => {
    const tiers = ACHIEVEMENT_DEFINITIONS.filter(
      (d) =>
        d.scope === scope &&
        d.period === g.period &&
        d.category === g.category &&
        d.metric === g.metric &&
        !d.streakType &&
        !d.teamType
    )
      .map((d) => ({ id: d.id, tier: d.tier, icon: d.icon, target: resolveTarget(d, context) }))
      .sort((a, b) => a.target - b.target)

    tiers.forEach((t, i) => { t.step = i + 1 })

    const rows = g.period === 'daily' ? context.todayRows : context.monthRows
    const current = num(sumMetrics(rows || [])[g.metric])
    tiers.forEach((t) => { t.unlocked = current >= t.target })

    const nextTier = tiers.find((t) => !t.unlocked) || null
    const lastUnlocked = [...tiers].reverse().find((t) => t.unlocked) || null

    let progressToNext = 100
    if (nextTier) {
      const base = lastUnlocked ? lastUnlocked.target : 0
      const span = nextTier.target - base
      progressToNext = span > 0 ? Math.min(100, Math.max(0, ((current - base) / span) * 100)) : 0
    }

    return {
      id: `${scope}-${g.period}-${g.category}`,
      period: g.period,
      category: g.category,
      metric: g.metric,
      current,
      tiers,
      nextTier,
      achievedCount: tiers.filter((t) => t.unlocked).length,
      totalCount: tiers.length,
      progressToNext,
      complete: !nextTier
    }
  })
}

export function tierClass(tier) {
  const map = {
    bronze: 'achievement-tier-bronze',
    silver: 'achievement-tier-silver',
    gold: 'achievement-tier-gold',
    platinum: 'achievement-tier-platinum'
  }
  return map[tier] || 'achievement-tier-bronze'
}
