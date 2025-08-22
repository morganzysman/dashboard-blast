<template>
  <div class="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
    <!-- Shifts calendar view -->
    <div class="card" v-if="$route.query.greeted === '1'">
      <div class="card-body">
        <div class="bg-green-50 border border-green-200 rounded p-3 text-green-800 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold">Thanks! Your {{ $route.query.type === 'in' ? 'clock-in' : 'clock-out' }} was registered.</p>
              <p v-if="$route.query.late" class="text-green-900">You are {{ $route.query.late }} minutes late.</p>
            </div>
            <button class="btn-secondary btn-sm" @click="dismissGreeting">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 class="text-md font-semibold">My Shifts (This Week)</h3>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <div class="text-gray-500 hidden lg:block" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
          <template v-for="(day, idx) in weekDays" :key="idx">
            <div class="border rounded p-2 min-h-[80px]">
              <!-- Mobile: show weekday label inside each cell -->
              <div class="text-[10px] text-gray-400 text-center lg:hidden">{{ day.wdLabel }}</div>
              <div class="text-[10px] text-gray-500 text-center">{{ day.label }}</div>
              <div class="mt-1 space-y-1" v-if="day.shift">
                <div class="text-gray-900 font-medium truncate lg:whitespace-normal text-center">{{ day.shift.account_name || day.shift.company_token }}</div>
                <div class="text-gray-600 text-[10px] text-center">{{ formatTimeShort(day.shift.start_time) }} – {{ formatTimeShort(day.shift.end_time) }}</div>
              </div>
              <div v-else class="text-gray-400">—</div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 class="text-lg font-bold text-gray-900">My Timesheet</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div class="inline-flex overflow-hidden rounded-md border border-gray-200">
              <button class="btn-secondary btn-sm flex items-center gap-1 rounded-none" @click="prevPeriod">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <span class="hidden xs:inline">Prev</span>
              </button>
              <button class="btn-secondary btn-sm flex items-center gap-1 border-l border-gray-200 rounded-none" @click="nextPeriod">
                <span class="hidden xs:inline">Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <button class="btn-primary btn-sm flex items-center gap-1" @click="loadEntries" :disabled="loading">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 2v6h-6"/></svg>
              <span class="hidden sm:inline">{{ loading ? 'Loading…' : 'Refresh' }}</span>
            </button>
          </div>
        </div>
        <div class="mt-4">
          <ResponsiveTable
            :items="entries"
            :columns="[
              { key: 'account', label: 'Account', headerClass: 'whitespace-normal', cellClass: 'whitespace-normal break-words max-w-[180px]', skeletonWidth: 'w-40' },
              { key: 'clock_in', label: 'Clock In', headerClass: 'whitespace-normal', cellClass: 'whitespace-normal', skeletonWidth: 'w-32' },
              { key: 'clock_out', label: 'Clock Out', headerClass: 'whitespace-normal', cellClass: 'whitespace-normal', skeletonWidth: 'w-24' },
              { key: 'duration', label: 'Duration', headerClass: 'whitespace-normal', cellClass: 'whitespace-normal', skeletonWidth: 'w-20' },
              { key: 'status', label: 'Status', headerClass: 'whitespace-normal', cellClass: 'whitespace-normal', skeletonWidth: 'w-16' }
            ]"
            :stickyHeader="true"
            :loading="loading"
            rowKeyField="id"
            mobileTitleField="account"
          >
            <template #cell-account="{ item }">{{ accountLabel(item.company_token) }}</template>
            <template #cell-clock_in="{ item }">{{ formatDateTime(item.clock_in_at) }}</template>
            <template #cell-clock_out="{ item }">{{ item.clock_out_at ? formatDateTime(item.clock_out_at) : '—' }}</template>
            <template #cell-duration="{ item }">{{ formatDuration(secondsBetween(item.clock_in_at, item.clock_out_at)) }}</template>
            <template #cell-status="{ item }">
              <div class="flex items-center gap-1">
                <span v-if="item.approved_by" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded" :title="`Approved by ${item.approved_by_name || 'Manager'}`">
                  ✓ Approved
                </span>
                <span v-else-if="item.clock_out_at" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  ⏳ Pending
                </span>
                <span v-if="item.paid" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  $ Paid
                </span>
              </div>
            </template>
            <template #mobile-card="{ item }">
              <div class="font-medium text-gray-900 dark:text-gray-100 mb-1">{{ accountLabel(item.company_token) }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">{{ formatDateTime(item.clock_in_at) }} → {{ item.clock_out_at ? formatDateTime(item.clock_out_at) : '—' }}</div>
              <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">Duration: {{ formatDuration(secondsBetween(item.clock_in_at, item.clock_out_at)) }}</div>
              <div class="flex items-center gap-1">
                <span v-if="item.approved_by" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded" :title="`Approved by ${item.approved_by_name || 'Manager'}`">
                  ✓ Approved
                </span>
                <span v-else-if="item.clock_out_at" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  ⏳ Pending
                </span>
                <span v-if="item.paid" class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  $ Paid
                </span>
              </div>
            </template>
          </ResponsiveTable>
          <div class="mt-4 text-right text-gray-800 font-medium space-y-1">
            <div>Total time: {{ formatDuration(totalSeconds) }}</div>
            <!-- <div>Total earned: {{ formatCurrency(totalAmount) }}</div> -->
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../utils/api'
import ResponsiveTable from '../components/ui/ResponsiveTable.vue'

const entries = ref([])
const loading = ref(false)
const auth = useAuthStore()
const period = ref({ start: '', end: '' })

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const secondsBetween = (a,b) => {
  if (!a || !b) return 0
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime())/1000)
}

const totalSeconds = computed(() => entries.value.reduce((s, e) => s + secondsBetween(e.clock_in_at, e.clock_out_at), 0))

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}

const formatDateTime = (iso) => {
  const timezone = auth.user?.timezone || 'America/Lima'
  return new Date(iso).toLocaleString('en-US', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
  const formatTimeShort = (t) => {
    if (!t) return ''
    try {
      // Check if t is a TIMESTAMPTZ (contains 'T' or 'Z') or a simple time string
      if (t.includes('T') || t.includes('Z')) {
        // t is a TIMESTAMPTZ, so create a Date object and format in company timezone
        const date = new Date(t)
        const timezone = auth.user?.timezone || 'America/Lima'
        return date.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      } else {
        // t is a simple time string like "16:00:00", parse it manually
        const [h, m] = t.toString().split(':')
        const hNum = Number(h)
        const ampm = hNum >= 12 ? 'PM' : 'AM'
        const h12 = ((hNum + 11) % 12) + 1
        return `${h12}:${m} ${ampm}`
      }
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', t)
      return t
    }
  }


// Map company_token to a readable account name if available from session
const accountLabel = (token) => {
  const accounts = auth.user?.userAccounts || []
  const acc = accounts.find(a => a.company_token === token)
  return acc?.account_name || token || '—'
}

// Build current week days and fetch shifts for the user
const weekDays = ref([])
const buildWeek = async () => {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const list = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    const wdLabel = d.toLocaleDateString(undefined, { weekday: 'short' })
    list.push({ date: d, dateStr, label: d.getDate(), wdLabel, shift: null })
  }
  // Fetch shifts assigned to this user
  try {
    const res = await api.getMyShifts()
    const shifts = res?.data || []
    for (let i = 0; i < list.length; i++) {
      const day = list[i]
      const s = shifts.find(x => x.date === day.dateStr)
      if (s && s.shift) {
        day.shift = {
          company_token: s.shift.company_token,
          account_name: s.shift.account_name,
          start_time: s.shift.start_time,
          end_time: s.shift.end_time
        }
      }
    }
  } catch {}
  weekDays.value = list
}

onMounted(buildWeek)

const loadEntries = async () => {
  loading.value = true
  // Frontend picks the correct range; default to server biweekly if not set
  let { start, end } = period.value
  if (!start || !end) {
    // compute current biweekly on client to be explicit
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()
    const pad = (n) => String(n).padStart(2, '0')
    if (day <= 15) {
      start = `${year}-${pad(month+1)}-01`
      end = `${year}-${pad(month+1)}-15`
    } else {
      start = `${year}-${pad(month+1)}-16`
      const endDate = new Date(year, month + 1, 0).getDate()
      end = `${year}-${pad(month+1)}-${pad(endDate)}`
    }
  }
  try {
    const res = await api.getMyEntries(start, end)
    if (res.success) {
      entries.value = res.data
      period.value = res.period
    }
  } finally {
    loading.value = false
  }
}

const computeHalfMonthPeriodForDate = (dateObj) => {
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth() // 0-based
  const day = dateObj.getDate()
  const pad = (n) => String(n).padStart(2, '0')
  if (day <= 15) {
    return {
      start: `${year}-${pad(month + 1)}-01`,
      end: `${year}-${pad(month + 1)}-15`
    }
  } else {
    const endDay = new Date(year, month + 1, 0).getDate()
    return {
      start: `${year}-${pad(month + 1)}-16`,
      end: `${year}-${pad(month + 1)}-${pad(endDay)}`
    }
  }
}

const prevPeriod = () => {
  // Determine current period and move to previous half-month
  let { start } = period.value
  if (!start) {
    // initialize to current period if empty
    period.value = computeHalfMonthPeriodForDate(new Date())
    start = period.value.start
  }
  const [y, m, d] = start.split('-').map(Number)
  const isFirstHalf = d === 1
  if (isFirstHalf) {
    // move to previous month second half
    const prevMonth = new Date(y, m - 2, 1) // m is 1-based in string, Date wants 0-based
    const endDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate()
    period.value = {
      start: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-16`,
      end: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    }
  } else {
    // move to same month first half
    period.value = {
      start: `${y}-${String(m).padStart(2, '0')}-01`,
      end: `${y}-${String(m).padStart(2, '0')}-15`
    }
  }
  loadEntries()
}

const nextPeriod = () => {
  // Determine current period and move to next half-month
  let { start } = period.value
  if (!start) {
    period.value = computeHalfMonthPeriodForDate(new Date())
    start = period.value.start
  }
  const [y, m, d] = start.split('-').map(Number)
  const isFirstHalf = d === 1
  if (isFirstHalf) {
    // move to same month second half
    const endDay = new Date(y, m, 0).getDate() // m here is 1-based; end of this month
    period.value = {
      start: `${y}-${String(m).padStart(2, '0')}-16`,
      end: `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    }
  } else {
    // move to next month first half
    const nextMonth = new Date(y, m, 1) // next month
    period.value = {
      start: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-15`
    }
  }
  loadEntries()
}

loadEntries()

const dismissGreeting = () => {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('greeted')
    url.searchParams.delete('type')
    url.searchParams.delete('late')
    url.searchParams.delete('clockAt')
    window.history.replaceState({}, '', url.toString())
  } catch {}
}
</script>

<style scoped>
</style>

