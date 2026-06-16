<template>
  <div v-if="isSingleDay && recordData" class="card border-2" :class="isNewCompanyRecord ? 'border-green-400' : 'border-primary-200'">
    <div class="card-body space-y-4">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div class="min-w-0">
          <h2 class="text-lg sm:text-xl font-bold text-gray-900">
            {{ isToday ? $t('dailyGoal.todayTitle') : $t('dailyGoal.dayTitle', { day: weekdayName }) }}
          </h2>
          <p class="text-xs sm:text-sm text-gray-600">
            {{ $t('dailyGoal.subtitle', { day: weekdayName }) }}
          </p>
        </div>
        <span
          v-if="isNewCompanyRecord"
          class="inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 animate-pulse"
        >
          <MaterialIcon name="emoji_events" :size="14" :filled="true" class="mr-1" />{{ $t('dailyGoal.newRecord') }}
        </span>
      </div>

      <!-- Company-level goal -->
      <div class="rounded-lg bg-gray-50 p-4">
        <div class="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div class="min-w-0">
            <p class="text-xs font-medium text-gray-500">{{ $t('dailyGoal.currentlySelling') }}</p>
            <p class="text-2xl sm:text-3xl font-bold" :class="isNewCompanyRecord ? 'text-green-600' : 'text-gray-900'">
              {{ formatCurrency(companyCurrent) }}
            </p>
          </div>
          <div class="text-right min-w-0">
            <p class="text-xs font-medium text-gray-500">{{ $t('dailyGoal.recordToBeat') }}</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-700">
              {{ companyRecord > 0 ? formatCurrency(companyRecord) : '—' }}
            </p>
            <p v-if="companyRecordDate" class="text-[11px] text-gray-400">{{ formatDisplayDate(companyRecordDate) }}</p>
          </div>
        </div>

        <ObjectiveProgress
          show-label
          :label="$t('dailyGoal.progressLabel')"
          :value="companyCurrent"
          :objective="companyRecord"
        />

        <p class="mt-2 text-xs sm:text-sm" :class="isNewCompanyRecord ? 'text-green-700 font-semibold' : 'text-gray-600'">
          <template v-if="!companyHasRecord">{{ $t('dailyGoal.noRecordYet', { day: weekdayName }) }}</template>
          <template v-else-if="isNewCompanyRecord">{{ $t('dailyGoal.beatBy', { amount: formatCurrency(companyCurrent - companyRecord) }) }}</template>
          <template v-else>{{ $t('dailyGoal.remaining', { amount: formatCurrency(companyRemaining) }) }}</template>
        </p>
      </div>

      <!-- Per-account goals -->
      <div v-if="accountRows.length > 1" class="space-y-3">
        <div>
          <p class="text-xs font-semibold text-gray-500">{{ $t('dailyGoal.perAccount') }}</p>
          <p class="text-[11px] text-gray-400">{{ $t('dailyGoal.perAccountHint', { day: weekdayName }) }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="row in accountRows"
            :key="row.accountKey"
            class="rounded-lg border p-3"
            :class="row.isNewRecord ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'"
          >
            <div class="flex items-center justify-between gap-2 mb-1 min-w-0">
              <span class="text-sm font-medium text-gray-800 truncate" :title="row.account">{{ row.account }}</span>
              <MaterialIcon v-if="row.isNewRecord" name="emoji_events" :size="16" :filled="true" class="flex-shrink-0 text-green-600" />
            </div>
            <div class="flex items-end justify-between gap-2 mb-2">
              <span class="text-base font-bold" :class="row.isNewRecord ? 'text-green-600' : 'text-gray-900'">
                {{ formatCurrency(row.current) }}
              </span>
              <div class="text-right flex-shrink-0">
                <span class="text-xs text-gray-500">
                  {{ $t('dailyGoal.goalShort') }}: {{ row.record > 0 ? formatCurrency(row.record) : '—' }}
                </span>
                <p v-if="row.recordDate" class="text-[10px] text-gray-400 leading-none">{{ formatDisplayDate(row.recordDate) }}</p>
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
  currentDateRange: Object,
  loading: Boolean
})

const authStore = useAuthStore()
const { locale } = useI18n()

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
        isNewRecord: record > 0 && current > record
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
