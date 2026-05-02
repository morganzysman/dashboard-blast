<template>
  <div class="space-y-4 lg:space-y-6">
    <div class="card">
      <div class="card-body">
        <!-- Header: title + month nav + account selector -->
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ $t('gainCalendar.title') }}</h2>
            <p class="text-sm text-gray-600">{{ monthLabel }}</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div class="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button class="btn-secondary btn-sm flex items-center gap-1 rounded-none" @click="prevMonth">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <span class="hidden xs:inline">{{ $t('common.previous') }}</span>
              </button>
              <button class="btn-secondary btn-sm flex items-center gap-1 border-l border-gray-200 rounded-none" @click="nextMonth">
                <span class="hidden xs:inline">{{ $t('common.next') }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <button
              class="btn-secondary btn-sm"
              :disabled="recalculating"
              @click="recalculateMonth"
            >
              {{ recalculating ? $t('gainCalendar.recalculating') : $t('gainCalendar.recalculate') }}
            </button>
          </div>
        </div>

        <!-- Account selector -->
        <div class="mt-4 mb-3 flex items-center gap-2 flex-wrap">
          <label class="text-xs text-gray-700">{{ $t('rentability.account') }}</label>
          <select v-model="selectedToken" class="form-input" @change="loadGains">
            <option value="">{{ $t('gainCalendar.allAccounts') }}</option>
            <option v-for="acc in accounts" :key="acc.company_token" :value="acc.company_token">
              {{ acc.account_name || acc.company_token }}
            </option>
          </select>
        </div>

        <!-- Monthly summary -->
        <div class="mt-2 mb-4 p-4 bg-gray-50 rounded-lg">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div class="flex gap-4 text-sm">
              <div class="flex items-center gap-1">
                <div class="w-3 h-3 rounded bg-green-500"></div>
                <span>{{ $t('gainCalendar.profit') }}</span>
              </div>
              <div class="flex items-center gap-1">
                <div class="w-3 h-3 rounded bg-red-500"></div>
                <span>{{ $t('gainCalendar.loss') }}</span>
              </div>
              <div class="flex items-center gap-1">
                <div class="w-3 h-3 rounded bg-gray-300"></div>
                <span>{{ $t('gainCalendar.noData') }}</span>
              </div>
            </div>
            <div class="text-lg font-bold" :class="monthTotal >= 0 ? 'text-green-600' : 'text-red-600'">
              {{ $t('gainCalendar.monthTotal') }}: {{ formatCurrency(monthTotal) }}
            </div>
          </div>
          <div class="mt-3">
            <ObjectiveProgress
              show-label
              :label="`${$t('gainCalendar.objective')} ${formatCurrency(monthObjective)}`"
              :value="monthTotal"
              :objective="monthObjective"
            />
          </div>
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 lg:gap-3 text-xs">
          <!-- Weekday headers (desktop) -->
          <div
            class="text-gray-500 hidden lg:block font-medium text-center"
            v-for="d in [$t('shifts.weekdays.0'), $t('shifts.weekdays.1'), $t('shifts.weekdays.2'), $t('shifts.weekdays.3'), $t('shifts.weekdays.4'), $t('shifts.weekdays.5'), $t('shifts.weekdays.6')]"
            :key="d"
          >{{ d }}</div>

          <!-- Day cells -->
          <div
            v-for="day in calendarGrid"
            :key="day.date || `empty-${day.index}`"
            class="border rounded-lg p-2 min-h-[80px] transition-all duration-200 relative"
            :class="getDayCellClass(day)"
            @mouseenter="hoveredDay = day.date"
            @mouseleave="hoveredDay = null"
          >
            <!-- Empty cell -->
            <template v-if="!day.date">
              <div class="h-full"></div>
            </template>

            <!-- Day with data -->
            <template v-else>
              <div class="text-[10px] text-gray-400 text-center lg:hidden">{{ day.weekday || '' }}</div>
              <div class="text-sm font-medium text-center" :class="day.isToday ? 'text-blue-600' : 'text-gray-700'">
                {{ day.label }}
                <span v-if="day.isToday" class="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">{{ $t('gainCalendar.today') }}</span>
              </div>

              <!-- Gain amount -->
              <div v-if="day.gain !== null" class="mt-2 text-center">
                <div
                  class="text-sm font-bold"
                  :class="day.gain >= 0 ? 'text-green-700' : 'text-red-700'"
                >
                  {{ formatCurrency(day.gain) }}
                </div>
                <div class="text-[9px] text-gray-500 mt-0.5">
                  {{ day.orders || 0 }} {{ $t('gainCalendar.orders') }}
                </div>
                <ObjectiveProgress
                  class="mt-1.5"
                  compact
                  :value="day.gain"
                  :objective="DAILY_GAIN_OBJECTIVE"
                  :tooltip="`${$t('gainCalendar.dailyObjective')}: ${formatCurrency(DAILY_GAIN_OBJECTIVE)}`"
                />
              </div>
              <div v-else class="mt-2 text-center text-[10px] text-gray-400">
                —
              </div>

              <!-- Hover tooltip with breakdown -->
              <div
                v-if="hoveredDay === day.date && day.gain !== null"
                class="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 rounded-lg shadow-lg text-[10px] border"
                style="background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border-color: rgba(0,0,0,0.1);"
              >
                <div class="font-bold text-gray-900 mb-1">{{ day.date }}</div>
                <div class="space-y-0.5 text-gray-700">
                  <div class="flex justify-between"><span>{{ $t('gainCalendar.grossRevenue') }}</span><span>{{ formatCurrency(day.grossRevenue) }}</span></div>
                  <div class="flex justify-between text-red-600"><span>{{ $t('gainCalendar.paymentFees') }}</span><span>-{{ formatCurrency(day.paymentFees) }}</span></div>
                  <div class="flex justify-between text-red-600"><span>{{ $t('gainCalendar.foodCosts') }}</span><span>-{{ formatCurrency(day.foodCosts) }}</span></div>
                  <div class="flex justify-between text-red-600"><span>{{ $t('gainCalendar.utilityCosts') }}</span><span>-{{ formatCurrency(day.utilityCosts) }}</span></div>
                  <div class="flex justify-between text-red-600"><span>{{ $t('gainCalendar.payrollCosts') }}</span><span>-{{ formatCurrency(day.payrollCosts) }}</span></div>
                  <hr class="my-1 border-gray-200">
                  <div class="flex justify-between font-bold" :class="day.gain >= 0 ? 'text-green-700' : 'text-red-700'">
                    <span>{{ $t('gainCalendar.netGain') }}</span>
                    <span>{{ formatCurrency(day.gain) }}</span>
                  </div>
                  <div class="flex justify-between text-gray-500">
                    <span>{{ $t('gainCalendar.dailyObjective') }}</span>
                    <span>{{ formatCurrency(DAILY_GAIN_OBJECTIVE) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Loading overlay -->
        <div v-if="loading" class="flex items-center justify-center py-8">
          <div class="loading-spinner"></div>
          <span class="ml-2 text-gray-500">{{ $t('common.loading') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api.js'
import ObjectiveProgress from '../components/ui/ObjectiveProgress.vue'
import { DAILY_GAIN_OBJECTIVE } from '../composables/useProfitability'

const { t } = useI18n()
const auth = useAuthStore()

// State
const loading = ref(false)
const recalculating = ref(false)
const hoveredDay = ref(null)
const selectedToken = ref('')
const accounts = ref([])
const gainsData = ref([])

// Current month (YYYY-MM)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1) // 1-indexed

const monthKey = computed(() => {
  return `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`
})

const monthLabel = computed(() => {
  const date = new Date(currentYear.value, currentMonth.value - 1, 1)
  const tz = auth.user?.timezone || 'America/Lima'
  return date.toLocaleDateString(auth.user?.language || 'es', { month: 'long', year: 'numeric', timeZone: tz })
})

// Month navigation
function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadGains()
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadGains()
}

// Build calendar grid
const calendarGrid = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const daysInMonth = new Date(year, month, 0).getDate()
  const tz = auth.user?.timezone || 'America/Lima'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })

  // Build gains lookup
  const gainsMap = new Map()
  for (const row of gainsData.value) {
    const dateStr = typeof row.date === 'string' ? row.date.split('T')[0] : row.date
    gainsMap.set(dateStr, row)
  }

  const grid = []

  // Get first day's weekday
  const firstDate = new Date(year, month - 1, 1)
  const firstWeekday = firstDate.getDay() // 0=Sun

  // Empty cells before first day
  for (let i = 0; i < firstWeekday; i++) {
    grid.push({ date: null, index: i, isEmpty: true })
  }

  // Weekday short names
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Safe number parse that handles null, undefined, NaN, and strings
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    const row = gainsMap.get(dateStr) || null

    grid.push({
      date: dateStr,
      label: d,
      weekday: weekdayNames[dayOfWeek],
      isToday: dateStr === todayStr,
      index: firstWeekday + d - 1,
      gain: row ? num(row.net_gain) : null,
      grossRevenue: row ? num(row.gross_revenue) : 0,
      paymentFees: row ? num(row.payment_fees) : 0,
      foodCosts: row ? num(row.food_costs) : 0,
      utilityCosts: row ? num(row.utility_costs) : 0,
      payrollCosts: row ? num(row.payroll_costs) : 0,
      orders: row ? num(row.orders_count) : 0
    })
  }

  return grid
})

// Month total
const monthTotal = computed(() => {
  let total = 0
  for (const d of calendarGrid.value) {
    if (d.gain !== null && !isNaN(d.gain)) {
      total += d.gain
    }
  }
  return total
})

// Number of days in the displayed month that have gain data (used to scale objective fairly)
const daysInMonthSoFar = computed(() => {
  let count = 0
  for (const d of calendarGrid.value) {
    if (d.date && d.gain !== null && !isNaN(d.gain)) count++
  }
  return count || 1
})

const monthObjective = computed(() => DAILY_GAIN_OBJECTIVE * daysInMonthSoFar.value)

// Cell styling based on gain
function getDayCellClass(day) {
  if (!day.date) return 'bg-gray-50'
  if (day.gain === null) return 'bg-white hover:bg-gray-50'
  if (day.gain > 0) return 'bg-green-50 border-green-200 hover:bg-green-100'
  if (day.gain < 0) return 'bg-red-50 border-red-200 hover:bg-red-100'
  return 'bg-gray-50 border-gray-200 hover:bg-gray-100'
}

// Currency formatting
function formatCurrency(n) {
  const symbol = auth.user?.currencySymbol || 'S/'
  const val = parseFloat(n)
  if (isNaN(val)) return `${symbol} 0.00`
  if (val < 0) return `-${symbol} ${Math.abs(val).toFixed(2)}`
  return `${symbol} ${val.toFixed(2)}`
}

// Load accounts
async function loadAccounts() {
  try {
    const companyId = auth.user?.company_id
    if (!companyId) return
    const res = await api.listCompanyAccounts(companyId)
    accounts.value = res.accounts || res.data || res || []
  } catch (err) {
    console.error('Failed to load accounts:', err)
  }
}

// Load gains data
async function loadGains() {
  loading.value = true
  try {
    const res = await api.getDailyGains(monthKey.value, selectedToken.value || null)
    gainsData.value = res.data || []
  } catch (err) {
    console.error('Failed to load daily gains:', err)
    gainsData.value = []
  } finally {
    loading.value = false
  }
}

// Recalculate entire month
async function recalculateMonth() {
  recalculating.value = true
  try {
    const year = currentYear.value
    const month = currentMonth.value
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    await api.backfillDailyGains(startDate, endDate)
    // Reload after a short delay to allow some computation
    setTimeout(() => loadGains(), 3000)
  } catch (err) {
    console.error('Failed to recalculate:', err)
  } finally {
    recalculating.value = false
  }
}

onMounted(async () => {
  await loadAccounts()
  await loadGains()
})
</script>
