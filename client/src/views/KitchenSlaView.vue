<template>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header + shared filters -->
    <div class="card">
      <div class="card-body space-y-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ $t('kitchenSla.title') }}</h1>
          <p class="text-sm text-gray-600 mt-1">{{ $t('kitchenSla.subtitleHub') }}</p>
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
          <button class="btn btn-outline btn-sm" :disabled="loading" @click="fetchAll">
            {{ loading ? $t('common.loading') : $t('common.refresh') }}
          </button>
          <span v-if="period.start" class="text-xs text-gray-500 ml-auto">
            {{ period.start }} → {{ period.end }}
          </span>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────── Section 1 ─────────────────────────────
         Account × Service performance matrix. This is the main SLA view:
         every account, every channel, on-time % at a glance, sorted alphabetically
         with a grand-total row at the bottom. Cells are color-coded so the worst
         (account, service) pairs jump out immediately.                        -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-lg font-medium text-gray-900">{{ $t('kitchenSla.matrixTitle') }}</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ $t('kitchenSla.matrixSubtitle') }}</p>
          </div>
        </div>

        <div v-if="matrixLoading" class="py-8 text-center text-sm text-gray-500">
          <span class="loading-spinner inline-block mr-2"></span>
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="!matrix.accounts.length || !matrix.channels.length" class="py-8 text-center text-sm text-gray-500">
          {{ $t('kitchenSla.matrixEmpty') }}
        </div>
        <div v-else class="overflow-x-auto -mx-4 sm:mx-0">
          <table class="w-full text-xs sm:text-sm">
            <thead>
              <tr class="bg-gray-50 text-gray-600">
                <th class="text-left font-medium px-2 sm:px-3 py-2 sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                  {{ $t('rentability.account') }}
                </th>
                <th
                  v-for="c in matrix.channels"
                  :key="c"
                  class="text-center font-medium px-2 py-2 min-w-[110px]"
                >
                  <div class="font-semibold text-gray-800">{{ channelLabel(c) }}</div>
                  <div class="text-[10px] text-gray-500">{{ $t('account.kitchenTableGoal') }}: {{ matrix.grandPerChannel?.[c]?.targetMinutes ?? '—' }}′</div>
                </th>
                <th class="text-center font-medium px-2 sm:px-3 py-2 bg-gray-100 min-w-[120px]">
                  {{ $t('kitchenSla.totalRow') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="acc in matrix.accounts"
                :key="acc.company_token"
                class="border-t border-gray-100 hover:bg-gray-50/40"
              >
                <td class="px-2 sm:px-3 py-2 sticky left-0 bg-white z-10 font-medium text-gray-900 truncate max-w-[180px]">
                  {{ acc.account_name }}
                </td>
                <td
                  v-for="c in matrix.channels"
                  :key="c"
                  class="text-center px-2 py-2"
                >
                  <component :is="cellComponent(acc.channels[c])" :stats="acc.channels[c]" />
                </td>
                <td class="text-center px-2 sm:px-3 py-2 bg-gray-50/60">
                  <component :is="cellComponent(acc.total)" :stats="acc.total" emphasised />
                </td>
              </tr>
              <!-- Grand-total row -->
              <tr class="border-t-2 border-gray-200 bg-gray-50 font-medium">
                <td class="px-2 sm:px-3 py-2 sticky left-0 bg-gray-50 z-10 text-gray-800">
                  {{ $t('kitchenSla.totalAllAccounts') }}
                </td>
                <td
                  v-for="c in matrix.channels"
                  :key="c"
                  class="text-center px-2 py-2"
                >
                  <component :is="cellComponent(matrix.grandPerChannel[c])" :stats="matrix.grandPerChannel[c]" emphasised />
                </td>
                <td class="text-center px-2 sm:px-3 py-2 bg-gray-100">
                  <component :is="cellComponent(matrix.grandTotal)" :stats="matrix.grandTotal" emphasised />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────── Section 2 ─────────────────────────────
         Per-cook leaderboard. Same data underneath the matrix, attributed
         per cook clocked-in at prepared_at. avg_cook_count surfaces solo
         vs team shifts so you can read the leaderboard fairly.                -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-start justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h2 class="text-lg font-medium text-gray-900">{{ $t('kitchenSla.leaderboardTitle') }}</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ $t('kitchenSla.leaderboardSubtitle') }}</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">{{ $t('rentability.account') }}</label>
            <select v-model="companyToken" @change="fetchLeaderboard" class="form-select w-56">
              <option value="">{{ $t('kitchenSla.allAccounts') }}</option>
              <option v-for="a in accounts" :key="a.company_token" :value="a.company_token">
                {{ a.account_name || a.company_token }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="leaderboardLoading" class="py-8 text-center text-sm text-gray-500">
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
                <th class="text-right" :title="$t('kitchenSla.avgPrepSecondary')">{{ $t('kitchenSla.medianPrep') }}</th>
                <th class="text-right" :title="$t('kitchenSla.avgTeamSizeHelp')">
                  {{ $t('kitchenSla.avgTeamSize') }}
                </th>
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
                <td
                  class="text-right text-sm text-gray-700"
                  :title="$t('account.kitchenScorecardAvgTooltip', { avg: `${Number(row.avg_prep_minutes).toFixed(1)}m`, n: row.orders_count })"
                >{{ row.median_prep_minutes != null ? `${Number(row.median_prep_minutes).toFixed(1)}m` : `${Number(row.avg_prep_minutes).toFixed(1)}m` }}</td>
                <td class="text-right text-sm">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="teamSizeBadgeClass(row.avg_cook_count)"
                  >
                    {{ Number(row.avg_cook_count || 1).toFixed(1) }}×
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="text-[11px] text-gray-500 mt-2 leading-relaxed">
            {{ $t('kitchenSla.attributionNote') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'

const authStore = useAuthStore()
const { t } = useI18n()

const rangeKey = ref('today')
const customStart = ref('')
const customEnd = ref('')
const period = ref({ start: '', end: '' })
const companyToken = ref('')
const accounts = ref([])
const rows = ref([])
const matrix = ref({ accounts: [], channels: [], grandPerChannel: {}, grandTotal: emptyStats() })
const matrixLoading = ref(false)
const leaderboardLoading = ref(false)
const loading = computed(() => matrixLoading.value || leaderboardLoading.value)

function emptyStats() {
  return {
    ordersCount: 0,
    onTimeCount: 0,
    lateCount: 0,
    onTimeRate: null,
    avgPrepMinutes: null,
    medianPrepMinutes: null,
    targetMinutes: null
  }
}

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
  fetchAll()
}

function applyCustom() {
  if (!customStart.value || !customEnd.value) return
  fetchAll()
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

function teamSizeBadgeClass(n) {
  const v = Number(n || 1)
  if (v <= 1.05) return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  if (v <= 2) return 'bg-sky-50 text-sky-700 border border-sky-100'
  return 'bg-violet-50 text-violet-700 border border-violet-100'
}

function channelLabel(key) {
  if (!key) return '—'
  const flat = key.replace(/:/g, '_').replace(/\*/g, 'GENERAL')
  const path = `account.kitchenChannelKeys.${flat}`
  const translated = t(path)
  if (translated !== path) return translated
  if (key === 'ONSITE:*') return t('account.kitchenChannelKeys.ONSITE_GENERAL')
  if (key === 'OTHER:*') return t('account.kitchenChannelKeys.OTHER_GENERAL')
  const parts = key.split(':')
  if (parts.length >= 2) return `${parts[0]} · ${parts[1]}`
  return key
}

// Inline functional component for matrix cells. Keeping it inline avoids
// shipping a tiny separate file for what is essentially a stat-rendering
// helper used in only one place. The empty-cell variant renders a soft dash
// so empty (account, service) pairs read as "no traffic" rather than zero.
function cellComponent(stats) {
  return {
    name: 'KitchenSlaCell',
    props: { stats: { type: Object, default: null }, emphasised: { type: Boolean, default: false } },
    setup(props) {
      return () => {
        const s = props.stats
        if (!s || !s.ordersCount) {
          return h('div', { class: 'text-gray-300 text-xs' }, '—')
        }
        const pct = Math.round((s.onTimeRate ?? 0) * 100)
        const cls =
          pct >= 90
            ? 'bg-emerald-100 text-emerald-800'
            : pct >= 70
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
        // Median-first display; mean drops to the tooltip as a secondary
        // signal. When the (legacy) median is missing for some reason — e.g.
        // an old daily row that pre-dates the median backfill window — we
        // fall back to mean so the cell never goes blank.
        const primaryMinutes =
          s.medianPrepMinutes != null ? s.medianPrepMinutes : s.avgPrepMinutes
        const tooltip =
          s.avgPrepMinutes != null
            ? t('account.kitchenScorecardAvgTooltip', {
                avg: `${Math.round(s.avgPrepMinutes)}m`,
                n: s.ordersCount
              })
            : null
        return h('div', { class: 'flex flex-col items-center gap-0.5' }, [
          h(
            'span',
            {
              class: `inline-block rounded-full px-2 py-0.5 text-xs font-bold leading-none ${cls} ${
                props.emphasised ? 'ring-1 ring-gray-200' : ''
              }`
            },
            `${pct}%`
          ),
          h(
            'span',
            { class: 'text-[10px] text-gray-500 leading-tight' },
            `${s.ordersCount} ${t('kitchenSla.ordersShort')}`
          ),
          primaryMinutes != null
            ? h(
                'span',
                {
                  class: 'text-[10px] text-gray-400 leading-tight',
                  title: tooltip || undefined
                },
                `${Math.round(primaryMinutes)}m ${$tCompare(primaryMinutes, s.targetMinutes)}`
              )
            : null
        ])
      }
    }
  }
}

// Small helper to render a bullet of "vs target". Returns "" when target is
// missing so the cell stays clean.
function $tCompare(avg, target) {
  if (avg == null || !target) return ''
  return `(${target}′)`
}

async function fetchAll() {
  await Promise.all([fetchMatrix(), fetchLeaderboard()])
}

async function fetchMatrix() {
  if (rangeKey.value === 'custom' && (!customStart.value || !customEnd.value)) return
  const r = computeRange(rangeKey.value)
  period.value = r
  matrixLoading.value = true
  try {
    const res = await api.getKitchenSlaAccountMatrix({ startDate: r.start, endDate: r.end })
    if (res.success && res.data) {
      matrix.value = {
        accounts: res.data.accounts || [],
        channels: res.data.channels || [],
        grandPerChannel: res.data.grandPerChannel || {},
        grandTotal: res.data.grandTotal || emptyStats()
      }
    } else {
      matrix.value = { accounts: [], channels: [], grandPerChannel: {}, grandTotal: emptyStats() }
    }
  } catch (err) {
    console.warn('kitchen-sla matrix fetch:', err)
    matrix.value = { accounts: [], channels: [], grandPerChannel: {}, grandTotal: emptyStats() }
  } finally {
    matrixLoading.value = false
  }
}

async function fetchLeaderboard() {
  if (rangeKey.value === 'custom' && (!customStart.value || !customEnd.value)) return
  const r = computeRange(rangeKey.value)
  period.value = r
  leaderboardLoading.value = true
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
    leaderboardLoading.value = false
  }
}

onMounted(fetchAll)
</script>

<style scoped>
.loading-spinner {
  @apply inline-block w-4 h-4 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin;
}
</style>
