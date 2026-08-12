<template>
  <div v-if="isSingleDay && recordData" class="card" :class="isNewCompanyRecord ? 'goal-card--record' : 'goal-card'">
    <div class="card-body space-y-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div class="min-w-0">
          <h2 class="text-h2 sm:text-h1">
            {{ isToday ? $t('dailyGoal.todayTitle') : $t('dailyGoal.dayTitle', { day: weekdayName }) }}
          </h2>
          <p class="text-small sm:text-body" style="color: var(--fg3);">
            {{ $t('dailyGoal.subtitle', { day: weekdayName }) }}
          </p>
        </div>
        <span v-if="isNewCompanyRecord" class="badge badge-success self-start animate-pulse">
          <MaterialIcon name="emoji_events" :size="14" :filled="true" class="mr-1" />{{ $t('dailyGoal.newRecord') }}
        </span>
      </div>

      <!-- Company-level goal -->
      <div class="rounded-lg p-4" style="background: var(--surface-2);">
        <div class="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div class="min-w-0">
            <p class="label-mono">{{ $t('dailyGoal.currentlySelling') }}</p>
            <p class="price text-2xl sm:text-3xl" :class="isNewCompanyRecord ? 'text-success-600' : 'text-fg-strong'">
              {{ formatCurrency(companyCurrent) }}
            </p>
          </div>
          <div class="text-right min-w-0">
            <p class="label-mono">{{ $t('dailyGoal.recordToBeat') }}</p>
            <p class="price text-xl sm:text-2xl" style="color: var(--fg1);">
              {{ companyRecord > 0 ? formatCurrency(companyRecord) : '—' }}
            </p>
            <p v-if="companyRecordDate" class="data text-[11px]" style="color: var(--fg-muted);">{{ formatDisplayDate(companyRecordDate) }}</p>
          </div>
        </div>

        <ObjectiveProgress
          show-label
          :label="$t('dailyGoal.progressLabel')"
          :value="companyCurrent"
          :objective="companyRecord"
        />

        <p class="mt-2 text-small sm:text-body" :class="isNewCompanyRecord ? 'text-success-700 font-semibold' : ''" :style="isNewCompanyRecord ? null : 'color: var(--fg3);'">
          <template v-if="!companyHasRecord">{{ $t('dailyGoal.noRecordYet', { day: weekdayName }) }}</template>
          <template v-else-if="isNewCompanyRecord">{{ $t('dailyGoal.beatBy', { amount: formatCurrency(companyCurrent - companyRecord) }) }}</template>
          <template v-else>{{ $t('dailyGoal.remaining', { amount: formatCurrency(companyRemaining) }) }}</template>
        </p>
      </div>

      <!-- Per-account goals -->
      <div v-if="accountRows.length > 1" class="space-y-3">
        <div>
          <p class="label-mono">{{ $t('dailyGoal.perAccount') }}</p>
          <p class="text-[11px]" style="color: var(--fg-muted);">{{ $t('dailyGoal.perAccountHint', { day: weekdayName }) }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="row in accountRows"
            :key="row.accountKey"
            class="rounded-lg border p-3"
            :class="row.isNewRecord ? 'border-success-300 bg-success-bg' : 'border-hairline bg-surface-1'"
          >
            <div class="flex items-center justify-between gap-2 mb-1 min-w-0">
              <span class="text-body font-semibold truncate" style="color: var(--fg1);" :title="row.account">{{ row.account }}</span>
              <MaterialIcon v-if="row.isNewRecord" name="emoji_events" :size="16" :filled="true" class="flex-shrink-0 text-success-600" />
            </div>
            <div v-if="row.providers.length" class="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2">
              <span
                v-for="p in row.providers"
                :key="p.provider"
                class="inline-flex items-center gap-1 text-[11px] leading-none"
                :title="providerTitle(p)"
              >
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  :class="providerDotClass(p.status)"
                  aria-hidden="true"
                />
                <span style="color: var(--fg3);">{{ providerLabel(p.provider) }}</span>
                <span
                  class="font-medium"
                  :class="providerTextClass(p.status)"
                >{{ providerStatusLabel(p.status) }}</span>
              </span>
            </div>
            <div class="flex items-end justify-between gap-2 mb-2">
              <span class="price text-base" :class="row.isNewRecord ? 'text-success-600' : 'text-fg-strong'">
                {{ formatCurrency(row.current) }}
              </span>
              <div class="text-right flex-shrink-0">
                <span class="data text-xs" style="color: var(--fg3);">
                  {{ $t('dailyGoal.goalShort') }}: {{ row.record > 0 ? formatCurrency(row.record) : '—' }}
                </span>
                <p v-if="row.recordDate" class="data text-[10px] leading-none" style="color: var(--fg-muted);">{{ formatDisplayDate(row.recordDate) }}</p>
              </div>
            </div>
            <ObjectiveProgress compact :value="row.current" :objective="row.record" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectiveProgress from './ui/ObjectiveProgress.vue'
import MaterialIcon from './ui/MaterialIcon.vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  recordData: Object,
  profitabilityData: Object,
  storeStatusData: Object,
  currentDateRange: Object,
  loading: Boolean
})

const authStore = useAuthStore()
const { t, locale } = useI18n()

const PROVIDER_ORDER = ['RAPPI', 'RAPPI_TURBO', 'PEDIDOSYA', 'UBER_EATS', 'DIDI', 'IFOOD', '99FOOD']

const providerLabel = (provider) => {
  const key = `dailyGoal.providers.${provider}`
  const label = t(key)
  return label === key ? provider : label
}

const providerTitle = (p) => {
  const name = providerLabel(p.provider)
  if (p.status === 'OPEN') return t('dailyGoal.storeOpenOn', { provider: name })
  if (p.status === 'CLOSED') return t('dailyGoal.storeClosedOn', { provider: name })
  return t('dailyGoal.storeUnknownOn', { provider: name })
}

const providerStatusLabel = (status) => {
  if (status === 'OPEN') return t('dailyGoal.storeOpen')
  if (status === 'CLOSED') return t('dailyGoal.storeClosed')
  return t('dailyGoal.storeUnknown')
}

const providerDotClass = (status) => {
  if (status === 'OPEN') return 'bg-success-600'
  if (status === 'CLOSED') return 'bg-error'
  return 'bg-fg-muted'
}

const providerTextClass = (status) => {
  if (status === 'OPEN') return 'text-success-700'
  if (status === 'CLOSED') return 'text-error'
  return 'text-fg-muted'
}

const statusByAccount = computed(() => {
  const map = new Map()
  for (const acc of props.storeStatusData?.accounts || []) {
    const known = (acc.providers || [])
      .filter((p) => p.status === 'OPEN' || p.status === 'CLOSED' || p.status === 'UNKNOWN')
      .sort((a, b) => {
        const rank = (name) => {
          const i = PROVIDER_ORDER.indexOf(name)
          return i === -1 ? PROVIDER_ORDER.length : i
        }
        return rank(a.provider) - rank(b.provider) || a.provider.localeCompare(b.provider)
      })
    map.set(acc.accountKey, known)
  }
  return map
})

const isSingleDay = computed(() => {
  const r = props.currentDateRange
  return !!(r && r.start && r.end && r.start === r.end)
})

const getCurrentDateInTimezone = () => {
  const timezone = authStore.user?.timezone || 'America/Lima'
  const now = new Date()
  const str = now.toLocaleString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const [year, month, day] = str.split('-')
  return `${year}-${month}-${day}`
}

const isToday = computed(() => isSingleDay.value && props.currentDateRange.start === getCurrentDateInTimezone())

const weekdayName = computed(() => {
  const dateStr = props.currentDateRange?.start
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(locale.value || 'en', { weekday: 'long' })
})

// Current sales come from the live profitability data, but only when its period
// matches the selected day (avoids showing stale numbers while it reloads).
const profitabilityInSync = computed(() => {
  const pd = props.profitabilityData
  const r = props.currentDateRange
  return !!(pd?.period?.start && pd?.period?.end && r?.start && r?.end &&
    pd.period.start === r.start && pd.period.end === r.end)
})

const companyCurrent = computed(() => {
  if (!profitabilityInSync.value) return 0
  return Number(props.profitabilityData?.company?.grossSales) || 0
})

const companyRecord = computed(() => Number(props.recordData?.company?.record) || 0)
const companyRecordDate = computed(() => props.recordData?.company?.date || null)
const companyHasRecord = computed(() => companyRecord.value > 0)
const companyRemaining = computed(() => Math.max(0, companyRecord.value - companyCurrent.value))
const isNewCompanyRecord = computed(() => companyHasRecord.value && companyCurrent.value > companyRecord.value)

// Per-account rows: driven by the live accounts (what's currently selling),
// with each account's same-weekday record attached.
const accountRows = computed(() => {
  if (!profitabilityInSync.value) return []
  const recordByKey = new Map((props.recordData?.accounts || []).map(a => [a.accountKey, a]))
  const liveAccounts = props.profitabilityData?.accounts || []
  return liveAccounts
    .map(acc => {
      const rec = recordByKey.get(acc.accountKey)
      const record = Number(rec?.record) || 0
      const current = Number(acc.grossSales) || 0
      return {
        accountKey: acc.accountKey,
        account: rec?.account || acc.account || acc.accountKey,
        current,
        record,
        recordDate: rec?.date || null,
        isNewRecord: record > 0 && current > record,
        providers: statusByAccount.value.get(acc.accountKey) || []
      }
    })
    .sort((a, b) => b.current - a.current)
})

const formatCurrency = (amount) => {
  const currencySymbol = authStore.user?.currencySymbol || 'S/'
  const num = Number(amount) || 0
  return `${currencySymbol} ${num.toFixed(2)}`
}

const formatDisplayDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString(locale.value || 'en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
/* Menta marca el objetivo del día; nunca con sombra, sólo con trazo. */
.goal-card {
  border: 2px solid var(--accent);
}

.goal-card--record {
  border: 2px solid var(--success);
}
</style>
