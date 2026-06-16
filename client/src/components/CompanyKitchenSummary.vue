<template>
  <div
    v-if="companyKitchen && companyKitchen.ordersWithPrepTime > 0"
    class="card"
  >
    <details :open="isDesktop" class="group">
      <summary
        class="card-body cursor-pointer list-none py-4 lg:cursor-default [&::-webkit-details-marker]:hidden"
      >
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 flex items-center gap-2">
              {{ $t('companyKitchen.title') }}
              <span
                class="lg:hidden text-xs font-normal text-teal-600 ml-1"
              >{{ $t('companyKitchen.tapToExpand') }}</span>
            </h3>
            <p class="text-xs text-gray-600 mt-0.5">
              {{ $t('companyKitchen.subtitle', { n: companyKitchen.accountsInKitchenAgg || 1 }) }}
            </p>
          </div>
          <div class="flex flex-col items-start gap-2 mt-2 sm:mt-0 sm:items-end">
            <!-- Executive-summary cause pills (kitchen / waiter / delivery).
                 Placed above the existing pill strip so the biggest
                 operational issue is the first thing the eye lands on, even
                 before the user expands the card. Hidden when the
                 company-wide totalEvaluated is 0. -->
            <div v-if="causePills.length" class="flex flex-wrap gap-2">
              <div
                v-for="b in causePills"
                :key="b.id"
                class="flex items-center gap-2 rounded px-2 py-1"
                :class="b.tone"
                :title="$t(`account.causePill.${b.id}Tooltip`)"
              >
                <span class="material-symbols-rounded leading-none" style="font-size: 18px;" aria-hidden="true">{{ b.icon }}</span>
                <div class="leading-tight">
                  <div class="text-xs font-semibold">
                    {{ b.count }}
                    <span class="font-normal">({{ formatCausePct(b.pct) }})</span>
                  </div>
                  <div class="text-[10px]">{{ $t(`account.causePill.${b.id}`) }}</div>
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 text-xs sm:text-sm">
            <span
              class="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-medium"
              :title="companyMedianPillTooltip"
            >
              {{ $t('companyKitchen.medianPrep') }}: {{ formatMedian(companyKitchen) }}
            </span>
            <span
              v-if="companyKitchen.sla"
              class="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 font-medium"
            >
              SLA: {{ companyKitchen.sla.overallSlaScore }}
              <span class="font-normal text-teal-700">· {{ onTimeLine(companyKitchen.sla) }}</span>
              <span
                class="text-teal-700/70 cursor-help select-none leading-none"
                :title="$t('kitchenSla.rateInfoTooltip')"
                aria-label="info"
              >ⓘ</span>
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              :class="coverageTone(coverageStats?.coveragePct)"
              :title="coverageTooltipText(coverageStats)"
            >
              {{ $t('kitchenSla.coverageLabel') }}: {{ coverageLabelText(coverageStats) }}
              <span
                class="cursor-help select-none leading-none opacity-70"
                :title="$t('kitchenSla.coverageTooltip')"
                aria-label="info"
              >ⓘ</span>
            </span>
            <span
              v-if="companyKitchen.sla?.slaBreachTotal"
              class="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 font-medium"
            >
              {{ $t('companyKitchen.lateOrders', { n: companyKitchen.sla.slaBreachTotal }) }}
            </span>
            </div>
          </div>
        </div>
      </summary>

      <div class="border-t border-gray-100 px-4 sm:px-6 pb-4 space-y-4">
        <!-- Per-service on-time scoreboard. Sorted worst-first so the channel
             that needs attention is the first thing the eye lands on. This is
             the primary performance signal at the company level — the per-
             account breach list is one layer deeper, inside each account card. -->
        <div v-if="serviceScorecard.length">
          <div class="flex items-baseline justify-between mb-1.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-[11px] font-semibold text-gray-800">{{ $t('companyKitchen.serviceScorecardTitle') }}</p>
              <span
                class="text-gray-400 cursor-help select-none leading-none text-[11px]"
                :title="$t('kitchenSla.rateInfoTooltip')"
                aria-label="info"
              >ⓘ</span>
            </div>
            <p class="text-[10px] text-gray-500">{{ $t('companyKitchen.serviceScorecardHint') }}</p>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div
              v-for="row in serviceScorecard"
              :key="row.channelKey"
              class="rounded-lg border bg-white p-2.5 flex flex-col gap-1"
              :class="onTimeBorderClass(row.onTimeRate)"
            >
              <div class="flex items-start justify-between gap-1">
                <p class="text-[11px] font-semibold text-gray-800 leading-tight truncate" :title="channelLabel(row.channelKey)">
                  {{ channelLabel(row.channelKey) }}
                </p>
                <span
                  class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap"
                  :class="onTimePillClass(row.onTimeRate)"
                >
                  {{ formatPct(row.onTimeRate) }}
                </span>
              </div>
              <div class="text-[10px] text-gray-600 grid grid-cols-3 gap-1 mt-0.5">
                <div class="flex flex-col">
                  <span class="text-gray-500 leading-tight">{{ $t('companyKitchen.orders') }}</span>
                  <span class="font-semibold text-gray-900">{{ row.ordersWithPrepTime }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-gray-500 leading-tight">{{ $t('account.kitchenTableGoal') }}</span>
                  <span class="font-semibold text-gray-900">{{ row.targetMinutes ?? '—' }}′</span>
                </div>
                <div class="flex flex-col" :title="scorecardTileTooltip(row)">
                  <span class="text-gray-500 leading-tight">{{ $t('account.kitchenScorecardMedian') }}</span>
                  <span class="font-semibold text-gray-900">{{ formatAvg(row.medianPreparationTime) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const props = defineProps({
  companyKitchen: { type: Object, default: null }
})

const { t } = useI18n()
const authStore = useAuthStore()

// SLA coverage pill — global aggregate (today). The matrix endpoint stores
// historical coverage too, but this card lives on the dashboard summary where
// the most actionable signal is *current operational health* ("are waiters
// marking prep right now?"), so we anchor it to today.
const coverageStats = ref(null)

function getTodayStr() {
  const tz = authStore.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

async function fetchCoverage() {
  try {
    const today = getTodayStr()
    const res = await api.getKitchenSlaAccountMatrix({ startDate: today, endDate: today })
    coverageStats.value = res?.data?.grandTotal || null
  } catch (err) {
    // Non-blocking — pill renders as "no data" if the request fails.
    console.warn('coverage fetch failed', err)
    coverageStats.value = null
  }
}

function coverageTone(pct) {
  if (pct == null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300'
  if (pct >= 0.8) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (pct >= 0.5) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
}

function coverageLabelText(stats) {
  if (!stats || stats.coverageEvaluated == null || stats.coveragePct == null) {
    return t('kitchenSla.coverageNoData')
  }
  return `${Math.round(stats.coveragePct * 100)}%`
}

function coverageTooltipText(stats) {
  if (!stats || stats.coverageEvaluated == null) {
    return t('kitchenSla.coverageTooltip')
  }
  return t('kitchenSla.coverageDenominator', {
    counted: stats.ordersCount || 0,
    total: stats.coverageEvaluated || 0,
    dropped: stats.unreliablePrepCount || 0
  })
}

const isDesktop = ref(true)
let mql
function applyMq() {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
}
onMounted(() => {
  applyMq()
  mql = window.matchMedia('(min-width: 1024px)')
  mql.addEventListener('change', applyMq)
  fetchCoverage()
})
onBeforeUnmount(() => {
  if (mql) mql.removeEventListener('change', applyMq)
})

const ch = computed(() => props.companyKitchen?.byKitchenChannel || {})

// Executive-summary cause pills mirror the per-account row in
// AccountDetails — same buckets, same tones, same tie-break — sourced
// from the company aggregate's `sla.causeCounts`. Kept in lockstep with
// the per-account renderer so the company and per-account headers always
// describe the same dataset with the same vocabulary.
const CAUSE_PILL_TIE_ORDER = ['kitchenDelay', 'waiterMissed', 'slowDelivery']
const CAUSE_PILL_TONES = {
  waiterMissed: 'bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  slowDelivery: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  kitchenDelay: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}
const CAUSE_PILL_ICONS = {
  kitchenDelay: 'cooking',
  waiterMissed: 'room_service',
  slowDelivery: 'delivery_dining'
}

const causePills = computed(() => {
  const cc = props.companyKitchen?.sla?.causeCounts
  if (!cc || !(cc.totalEvaluated > 0)) return []
  const denom = cc.totalEvaluated
  const ids = ['kitchenDelay', 'waiterMissed', 'slowDelivery']
  const pills = ids.map((id) => {
    const count = cc[id] || 0
    return {
      id,
      count,
      // Round to 1 decimal; Math.round(x*10)/10 drops trailing .0 so a clean
      // 28% reads as "28%", not "28.0%", while 28.5% stays "28.5%".
      pct: denom > 0 ? Math.round((count / denom) * 1000) / 10 : null,
      icon: CAUSE_PILL_ICONS[id],
      tone: CAUSE_PILL_TONES[id]
    }
  })
  pills.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return CAUSE_PILL_TIE_ORDER.indexOf(a.id) - CAUSE_PILL_TIE_ORDER.indexOf(b.id)
  })
  return pills
})

function formatCausePct(pct) {
  if (pct == null || Number.isNaN(pct)) return '—'
  return `${pct}%`
}

// Worst-on-time-first ordering; ties broken by highest volume so the channel
// that hurts the most customers floats to the top.
const serviceScorecard = computed(() => {
  const rows = Object.entries(ch.value)
    .filter(([, v]) => v && v.ordersWithPrepTime > 0)
    .map(([channelKey, v]) => ({ channelKey, ...v }))
  rows.sort((a, b) => {
    const ar = a.onTimeRate ?? 0
    const br = b.onTimeRate ?? 0
    if (ar !== br) return ar - br
    return (b.ordersWithPrepTime || 0) - (a.ordersWithPrepTime || 0)
  })
  return rows
})

function onTimePillClass(r) {
  if (r == null) return 'bg-gray-100 text-gray-700'
  if (r >= 0.9) return 'bg-emerald-100 text-emerald-800'
  if (r >= 0.7) return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function onTimeBorderClass(r) {
  if (r == null) return 'border-gray-100'
  if (r >= 0.9) return 'border-emerald-200/80'
  if (r >= 0.7) return 'border-amber-200/80'
  return 'border-rose-200/80'
}

function formatAvg(m) {
  if (m == null || Number.isNaN(m)) return '—'
  return `${Math.round(m)}m`
}

/**
 * Median-first formatter for the company-level pill. Mirrors AccountDetails'
 * `formatKitchenMedian` so the company and per-account headers always read
 * the same number for the same dataset.
 */
function formatMedian(kp) {
  if (!kp) return '—'
  const m =
    kp.medianPreparationTime != null
      ? kp.medianPreparationTime
      : kp.averagePreparationTime
  return formatAvg(m)
}

const companyMedianPillTooltip = computed(() => {
  const kp = props.companyKitchen
  if (!kp || !kp.ordersWithPrepTime) return ''
  return t('account.kitchenScorecardAvgTooltip', {
    avg: formatAvg(kp.averagePreparationTime),
    n: kp.prepMinutesSamples ?? kp.ordersWithPrepTime
  })
})

function scorecardTileTooltip(row) {
  if (!row) return ''
  return t('account.kitchenScorecardAvgTooltip', {
    avg: formatAvg(row.averagePreparationTime),
    n: row.prepMinutesSamples ?? row.ordersWithPrepTime ?? 0
  })
}

function formatPct(r) {
  if (r == null || Number.isNaN(r)) return '—'
  return `${Math.round(r * 100)}%`
}

function onTimeLine(sla) {
  if (!sla?.totalScoredOrders) return ''
  const pct = Math.round((sla.overallOnTimeRate || 0) * 100)
  return t('account.kitchenOnTimeLine', { pct })
}

function channelLabel(key) {
  if (!key) return '—'
  const flat = key.replace(/:/g, '_')
  const path = `account.kitchenChannelKeys.${flat}`
  const translated = t(path)
  if (translated !== path) return translated
  const parts = key.split(':')
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`
  return key
}
</script>
