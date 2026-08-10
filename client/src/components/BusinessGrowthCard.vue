<template>
  <div v-if="hasData" class="card">
    <div class="card-body space-y-4 transition-opacity" :class="{ 'opacity-60': loading }">
      <!-- Header + window selector -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-h2 sm:text-h1">{{ $t('growth.title') }}</h2>
          <p class="text-small sm:text-body" style="color: var(--fg3);">
            {{ $t('growth.subtitle', { weeks }) }}
          </p>
        </div>
        <div class="flex flex-shrink-0 gap-1 rounded-lg p-1" style="background: var(--surface-2);">
          <button
            v-for="option in weekOptions"
            :key="option"
            type="button"
            class="label-mono rounded px-2 py-1 text-[11px] transition-colors"
            :class="option === weeks ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg-strong'"
            @click="setWeeks(option)"
          >
            {{ $t('growth.weeksShort', { weeks: option }) }}
          </button>
        </div>
      </div>

      <!-- Headline: revenue for the window vs the one before it -->
      <div class="rounded-lg p-4" style="background: var(--surface-2);">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="min-w-0">
            <p class="label-mono">{{ $t('growth.revenueInWindow') }}</p>
            <p class="price text-2xl sm:text-3xl text-fg-strong">{{ formatCurrency(company.current.grossRevenue) }}</p>
            <p class="text-small mt-1" style="color: var(--fg3);">
              {{ $t('growth.versusPrevious', { amount: formatCurrency(company.previous.grossRevenue) }) }}
            </p>
          </div>
          <div class="text-right">
            <p class="label-mono">{{ $t('growth.change') }}</p>
            <p class="price text-2xl sm:text-3xl" :class="toneClass(company.change.grossRevenue.pct)">
              {{ formatPercent(company.change.grossRevenue.pct) }}
            </p>
            <p class="data text-[11px]" style="color: var(--fg-muted);">
              {{ formatSignedCurrency(company.change.grossRevenue.abs) }}
            </p>
          </div>
        </div>

        <!-- Weekly revenue trend: muted for the baseline window, accent for the current one -->
        <svg
          v-if="spark"
          class="mt-3 w-full"
          :viewBox="`0 0 ${spark.width} ${spark.height}`"
          preserveAspectRatio="none"
          role="img"
          :aria-label="$t('growth.sparkAria', { weeks: weeks * 2 })"
          style="height: 52px;"
        >
          <polyline
            v-if="spark.previousPoints"
            :points="spark.previousPoints"
            fill="none"
            :stroke="spark.mutedColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <polyline
            :points="spark.currentPoints"
            fill="none"
            :stroke="spark.accentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          />
          <circle :cx="spark.lastX" :cy="spark.lastY" r="3" :fill="spark.accentColor" />
        </svg>
        <div v-if="spark" class="mt-1 flex justify-between">
          <span class="data text-[10px]" style="color: var(--fg-muted);">{{ formatShortDate(windowInfo.previous.start) }}</span>
          <span class="data text-[10px]" style="color: var(--fg-muted);">{{ formatShortDate(windowInfo.current.end) }}</span>
        </div>
      </div>

      <!-- What moved: revenue only ever changes through orders or ticket size -->
      <div class="grid gap-3" :class="metricsGridClass">
        <div v-for="metric in secondaryMetrics" :key="metric.key" class="rounded-lg border border-hairline bg-surface-1 p-3">
          <p class="label-mono truncate">{{ metric.label }}</p>
          <p class="price text-base text-fg-strong">{{ metric.value }}</p>
          <p class="data text-xs" :class="toneClass(metric.tone)">
            {{ metric.delta }}
            <span style="color: var(--fg-muted);">{{ $t('growth.previouslyShort', { value: metric.previous }) }}</span>
          </p>
          <p v-if="metric.note" class="data text-[11px]" style="color: var(--fg-muted);">{{ metric.note }}</p>
        </div>
      </div>

      <!-- Plain-language read on which lever moved -->
      <p v-if="driverMessage" class="text-small sm:text-body" style="color: var(--fg1);">
        <MaterialIcon :name="driverIcon" :size="16" class="mr-1 align-text-bottom" />{{ driverMessage }}
      </p>

      <!-- Contribution by location, in money rather than percentages -->
      <div v-if="accountRows.length > 1" class="space-y-3">
        <div>
          <p class="label-mono">{{ $t('growth.byAccount') }}</p>
          <p class="text-[11px]" style="color: var(--fg-muted);">{{ $t('growth.byAccountHint') }}</p>
        </div>
        <div class="space-y-2">
          <div v-for="row in accountRows" :key="row.accountKey" class="flex items-center gap-3">
            <span class="text-body min-w-0 flex-1 truncate" style="color: var(--fg1);" :title="row.account">
              {{ row.account }}
              <span v-if="row.isNew" class="badge badge-neutral ml-1">{{ $t('growth.newLocation') }}</span>
            </span>
            <!-- Diverging bar: gains grow right of centre, losses left -->
            <div class="relative h-2 w-24 flex-shrink-0 overflow-hidden rounded-full sm:w-40" style="background: var(--surface-2);">
              <div
                class="absolute top-0 bottom-0"
                :class="row.abs >= 0 ? 'bg-success-500' : 'bg-error-400'"
                :style="row.barStyle"
              ></div>
              <div class="absolute top-0 bottom-0 left-1/2 w-px" style="background: var(--border-strong);"></div>
            </div>
            <span class="data w-24 flex-shrink-0 text-right text-xs" :class="toneClass(row.abs)">
              {{ formatSignedCurrency(row.abs) }}
            </span>
            <span class="data w-14 flex-shrink-0 text-right text-xs" style="color: var(--fg-muted);">
              {{ row.isNew ? $t('growth.newShort') : formatPercent(row.pct) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Honest about a baseline we only partially hold -->
      <p v-if="!coverageComplete" class="text-[11px]" style="color: var(--fg-muted);">
        {{ $t('growth.partialBaseline', { days: coverage.previousDaysPresent, total: windowInfo.days }) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MaterialIcon from './ui/MaterialIcon.vue'
import { useAuthStore } from '../stores/auth'
import { token, alpha } from '../utils/brandPalette'
import api from '../utils/api'

const props = defineProps({
  timezone: { type: String, default: 'America/Lima' }
})

const authStore = useAuthStore()
const { t, locale } = useI18n()

const weekOptions = [4, 13, 26]
const weeks = ref(13)
const growthData = ref(null)
const loading = ref(false)

const fetchGrowth = async () => {
  loading.value = true
  try {
    const res = await api.getGrowth(weeks.value, props.timezone)
    growthData.value = res.success ? res.data : null
  } catch (err) {
    console.warn('⚠️ Growth fetch failed:', err)
    growthData.value = null
  } finally {
    loading.value = false
  }
}

const setWeeks = (value) => {
  if (value === weeks.value) return
  weeks.value = value
}

watch(weeks, fetchGrowth)
onMounted(fetchGrowth)

const company = computed(() => growthData.value?.company || null)
const windowInfo = computed(() => growthData.value?.window || null)
const coverage = computed(() => growthData.value?.coverage || null)
const coverageComplete = computed(() => coverage.value?.previousComplete !== false)

// Nothing to say until at least one of the two windows holds revenue.
const hasData = computed(() => {
  const c = company.value
  return !!c && (c.current.grossRevenue > 0 || c.previous.grossRevenue > 0)
})

const formatCurrency = (amount, decimals = 0) => {
  const symbol = authStore.user?.currencySymbol || 'S/'
  const num = Number(amount) || 0
  return `${symbol} ${num.toLocaleString(locale.value || 'en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

const formatSignedCurrency = (amount, decimals = 0) => {
  const num = Number(amount) || 0
  return `${num > 0 ? '+' : num < 0 ? '−' : ''}${formatCurrency(Math.abs(num), decimals)}`
}

const formatPercent = (pct) => {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${Math.abs(pct).toFixed(1)}%`
}

const formatPoints = (points) => {
  if (!Number.isFinite(points)) return '—'
  const sign = points > 0 ? '+' : points < 0 ? '−' : ''
  return `${sign}${Math.abs(points).toFixed(1)} pp`
}

const formatShortDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString(locale.value || 'en', { month: 'short', day: 'numeric' })
}

// Negative is good nowhere on this card, so a single mapping serves every metric.
const toneClass = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return 'text-fg-muted'
  return value > 0 ? 'text-success-600' : 'text-error-600'
}

const secondaryMetrics = computed(() => {
  const c = company.value
  if (!c) return []
  const rows = [
    {
      key: 'orders',
      label: t('growth.orders'),
      value: c.current.orders.toLocaleString(locale.value || 'en'),
      previous: c.previous.orders.toLocaleString(locale.value || 'en'),
      delta: formatPercent(c.change.orders.pct),
      tone: c.change.orders.pct
    },
    {
      key: 'avgTicket',
      label: t('growth.avgTicket'),
      value: formatCurrency(c.current.avgTicket, 2),
      previous: formatCurrency(c.previous.avgTicket, 2),
      delta: formatPercent(c.change.avgTicket.pct),
      tone: c.change.avgTicket.pct
    },
    {
      key: 'netGain',
      label: t('growth.netGain'),
      value: formatCurrency(c.current.netGain),
      previous: formatCurrency(c.previous.netGain),
      delta: formatPercent(c.change.netGain.pct),
      tone: c.change.netGain.pct,
      // Margin says whether the extra revenue was worth what it cost to get.
      note: t('growth.marginNote', {
        margin: `${c.current.margin.toFixed(1)}%`,
        points: formatPoints(c.change.margin.abs)
      })
    }
  ]
  // Order counts are backfilled independently; hide the metrics they'd distort.
  return c.ordersReliable ? rows : rows.filter(r => r.key === 'netGain')
})

const metricsGridClass = computed(() => {
  const count = secondaryMetrics.value.length
  if (count >= 3) return 'grid-cols-1 sm:grid-cols-3'
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2'
  return 'grid-cols-1'
})

// Revenue = orders × ticket, so growth always traces back to one or both.
const driver = computed(() => {
  const c = company.value
  if (!c || !c.ordersReliable) return null
  const orders = c.change.orders.pct
  const ticket = c.change.avgTicket.pct
  if (!Number.isFinite(orders) || !Number.isFinite(ticket)) return null

  const flat = (v) => Math.abs(v) < 1
  if (!flat(orders) && !flat(ticket) && Math.sign(orders) === Math.sign(ticket)) {
    return { key: orders > 0 ? 'bothUp' : 'bothDown', orders, ticket }
  }
  const dominant = Math.abs(orders) >= Math.abs(ticket) ? 'orders' : 'ticket'
  return { key: dominant, orders, ticket }
})

const driverMessage = computed(() => {
  const d = driver.value
  if (!d) return ''
  return t(`growth.driver.${d.key}`, {
    orders: formatPercent(d.orders),
    ticket: formatPercent(d.ticket)
  })
})

const driverIcon = computed(() => {
  const pct = company.value?.change?.grossRevenue?.pct
  if (!Number.isFinite(pct) || pct === 0) return 'trending_flat'
  return pct > 0 ? 'trending_up' : 'trending_down'
})

// Contribution in money: a percentage flatters a location opening from zero and
// understates the one that actually carries the chain.
const accountRows = computed(() => {
  const accounts = growthData.value?.accounts || []
  const widest = Math.max(1, ...accounts.map(a => Math.abs(a.change.grossRevenue.abs)))
  return accounts
    .map(a => {
      const abs = a.change.grossRevenue.abs
      const halfWidth = (Math.abs(abs) / widest) * 50
      return {
        accountKey: a.accountKey,
        account: a.account,
        isNew: a.isNew,
        abs,
        pct: a.change.grossRevenue.pct,
        barStyle: abs >= 0
          ? { left: '50%', width: `${halfWidth}%` }
          : { right: '50%', width: `${halfWidth}%` }
      }
    })
    .sort((a, b) => b.abs - a.abs)
})

const spark = computed(() => {
  const points = growthData.value?.weekly || []
  if (points.length < 2) return null

  const width = 320
  const height = 48
  const pad = 3
  const maxY = Math.max(1, ...points.map(p => Number(p.grossRevenue) || 0))
  const xAt = (i) => pad + (i * (width - pad * 2)) / (points.length - 1)
  const yAt = (v) => height - pad - ((Number(v) || 0) / maxY) * (height - pad * 2)

  const toPolyline = (slice, offset) =>
    slice.map((p, i) => `${xAt(i + offset)},${yAt(p.grossRevenue)}`).join(' ')

  // Points are chronological, so the current window is the tail. When no week is
  // flagged current the whole line is baseline, not the other way round.
  const found = points.findIndex(p => p.inCurrent)
  const firstCurrent = found === -1 ? points.length : found
  const hasPrevious = firstCurrent > 0
  const hasCurrent = firstCurrent < points.length

  return {
    width,
    height,
    accentColor: token('--accent'),
    mutedColor: alpha(token('--fg3'), 0.55),
    // The baseline line includes the first current point so the two lines meet.
    previousPoints: hasPrevious
      ? toPolyline(points.slice(0, Math.min(firstCurrent + 1, points.length)), 0)
      : null,
    currentPoints: hasCurrent ? toPolyline(points.slice(firstCurrent), firstCurrent) : '',
    lastX: xAt(points.length - 1),
    lastY: yAt(points[points.length - 1].grossRevenue)
  }
})

defineExpose({ refresh: fetchGrowth })
</script>
