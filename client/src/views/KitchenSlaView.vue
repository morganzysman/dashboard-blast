<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="card-body space-y-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">⏱ {{ $t('kitchenSla.title') }}</h1>
          <p class="text-sm text-gray-600 mt-1">{{ $t('kitchenSla.subtitle') }}</p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">{{ $t('kitchenSla.dateRange') }}</label>
            <select v-model="rangeKey" @change="onRangeChange" class="form-select w-44">
              <option value="today">{{ $t('common.today') }}</option>
              <option value="yesterday">{{ $t('common.yesterday') }}</option>
              <option value="last7">{{ $t('dashboard.last7Days') }}</option>
              <option value="last30">{{ $t('dashboard.last30Days') }}</option>
              <option value="custom">{{ $t('common.customRange') }}</option>
            </select>
          </div>
          <div v-if="rangeKey === 'custom'" class="flex items-center gap-2">
            <input type="date" v-model="customStart" class="form-input text-sm" />
            <span class="text-gray-400">→</span>
            <input type="date" v-model="customEnd" class="form-input text-sm" />
            <button class="btn-sm btn-secondary" :disabled="!customStart || !customEnd" @click="applyCustom">
              {{ $t('common.apply') }}
            </button>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">{{ $t('rentability.account') }}</label>
            <select v-model="companyToken" @change="fetch" class="form-select w-56">
              <option value="">{{ $t('kitchenSla.allAccounts') }}</option>
              <option v-for="a in accounts" :key="a.company_token" :value="a.company_token">
                {{ a.account_name || a.company_token }}
              </option>
            </select>
          </div>
          <button class="btn-sm btn-secondary" :disabled="loading" @click="fetch">
            {{ loading ? $t('common.loading') : $t('common.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-medium text-gray-900">🍳 {{ $t('kitchenSla.leaderboardTitle') }}</h2>
          <span class="text-xs text-gray-500" v-if="period.start">
            {{ period.start }} → {{ period.end }}
          </span>
        </div>

        <div v-if="loading" class="py-8 text-center text-sm text-gray-500">
          <span class="loading-spinner inline-block mr-2"></span>
          {{ $t('common.loading') }}
        </div>

        <div v-else-if="rows.length === 0" class="py-8 text-center text-sm text-gray-500">
          {{ $t('kitchenSla.noData') }}
        </div>

        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead class="table-header">
              <tr>
                <th>{{ $t('admin.user') }}</th>
                <th>{{ $t('rentability.account') }}</th>
                <th class="text-right">{{ $t('kitchenSla.ordersCount') }}</th>
                <th class="text-right">{{ $t('kitchenSla.onTime') }}</th>
                <th class="text-right">{{ $t('kitchenSla.late') }}</th>
                <th class="text-right">{{ $t('kitchenSla.onTimePct') }}</th>
                <th class="text-right">{{ $t('kitchenSla.avgPrep') }}</th>
              </tr>
            </thead>
            <tbody class="table-body">
              <tr v-for="row in rows" :key="`${row.user_id}-${row.company_token}`">
                <td>
                  <div class="text-sm font-medium text-gray-900">{{ row.name }}</div>
                  <div class="text-xs text-gray-500">{{ row.email }}</div>
                </td>
                <td class="text-sm text-gray-700">{{ accountLabel(row.company_token) }}</td>
                <td class="text-right text-sm font-medium text-gray-900">{{ row.orders_count }}</td>
                <td class="text-right text-sm text-emerald-700">{{ row.on_time_count }}</td>
                <td class="text-right text-sm text-rose-700">{{ row.late_count }}</td>
                <td class="text-right text-sm font-medium" :class="onTimeClass(row)">
                  {{ onTimePct(row) }}%
                </td>
                <td class="text-right text-sm text-gray-700">{{ Number(row.avg_prep_minutes).toFixed(1) }}m</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const authStore = useAuthStore()

const rangeKey = ref('today')
const customStart = ref('')
const customEnd = ref('')
const period = ref({ start: '', end: '' })
const companyToken = ref('')
const accounts = ref([])
const rows = ref([])
const loading = ref(false)

function getTodayStr() {
  const tz = authStore.user?.timezone || 'America/Lima'
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}
function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function computeRange(key) {
  const today = getTodayStr()
  switch (key) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const y = shiftDays(today, -1)
      return { start: y, end: y }
    }
    case 'last7':
      return { start: shiftDays(today, -6), end: today }
    case 'last30':
      return { start: shiftDays(today, -29), end: today }
    case 'custom':
      return { start: customStart.value, end: customEnd.value }
    default:
      return { start: today, end: today }
  }
}

function onRangeChange() {
  if (rangeKey.value === 'custom') {
    if (!customStart.value || !customEnd.value) return
  }
  fetch()
}

function applyCustom() {
  if (!customStart.value || !customEnd.value) return
  fetch()
}

function accountLabel(token) {
  const found = accounts.value.find((a) => a.company_token === token)
  return found?.account_name || token
}

function onTimePct(row) {
  const n = Number(row.orders_count) || 0
  if (!n) return 0
  return Math.round((Number(row.on_time_count) / n) * 100)
}

function onTimeClass(row) {
  const p = onTimePct(row)
  if (p >= 90) return 'text-emerald-700'
  if (p >= 70) return 'text-amber-700'
  return 'text-rose-700'
}

async function fetch() {
  if (rangeKey.value === 'custom' && (!customStart.value || !customEnd.value)) return
  const r = computeRange(rangeKey.value)
  period.value = r
  loading.value = true
  try {
    const res = await api.getEmployeeSlaLeaderboard({
      startDate: r.start,
      endDate: r.end,
      companyToken: companyToken.value || undefined
    })
    if (res.success) {
      accounts.value = res.data?.accounts || []
      rows.value = res.data?.rows || []
    } else {
      rows.value = []
    }
  } catch (err) {
    console.warn('kitchen-sla leaderboard fetch:', err)
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetch)
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style>
