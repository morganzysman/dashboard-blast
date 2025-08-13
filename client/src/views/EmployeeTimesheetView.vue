<template>
  <div class="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
    <!-- Shifts calendar view -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-md font-semibold">My Shifts (This Week)</h3>
        </div>
        <div class="grid grid-cols-7 gap-2 text-xs">
          <div class="text-gray-500" v-for="d in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="d">{{ d }}</div>
          <template v-for="(day, idx) in weekDays" :key="idx">
            <div class="border rounded p-2 min-h-[80px]">
              <div class="text-[10px] text-gray-500">{{ day.label }}</div>
              <div class="mt-1 space-y-1" v-if="day.shift">
                <div class="text-gray-900 font-medium">{{ day.shift.account_name || day.shift.company_token }}</div>
                <div class="text-gray-600">{{ day.shift.start_time }} - {{ day.shift.end_time }}</div>
              </div>
              <div v-else class="text-gray-400">—</div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">My Timesheet</h2>
            <p class="text-sm text-gray-600">Period: {{ periodLabel }}</p>
          </div>
          <div class="space-x-2">
            <button class="btn-secondary btn-sm" @click="prevPeriod">Prev</button>
            <button class="btn-secondary btn-sm" @click="nextPeriod">Next</button>
            <button class="btn-primary btn-sm" @click="loadEntries">Refresh</button>
          </div>
        </div>
        <div class="mt-4">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-gray-600">
                <th class="py-2">Account</th>
                <th class="py-2">Clock In</th>
                <th class="py-2">Clock Out</th>
                <th class="py-2">Duration</th>
                <th class="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in entries" :key="e.id" class="border-t">
                <td class="py-2">{{ accountLabel(e.company_token) }}</td>
                <td class="py-2">{{ formatDateTime(e.clock_in_at) }}</td>
                <td class="py-2">{{ e.clock_out_at ? formatDateTime(e.clock_out_at) : '—' }}</td>
                <td class="py-2">{{ formatDuration(secondsBetween(e.clock_in_at, e.clock_out_at)) }}</td>
                <td class="py-2 flex items-center justify-end gap-2"><span>{{ formatCurrency(e.amount) }}</span><span v-if="e.paid" class="text-green-600">$</span></td>
              </tr>
            </tbody>
          </table>
          <div class="mt-4 text-right text-gray-800 font-medium space-y-1">
            <div>Total time: {{ formatDuration(totalSeconds) }}</div>
            <div>Total earned: {{ formatCurrency(totalAmount) }}</div>
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

const entries = ref([])
const auth = useAuthStore()
const period = ref({ start: '', end: '' })

const periodLabel = computed(() => `${period.value.start} → ${period.value.end}`)

const secondsBetween = (a,b) => {
  if (!a || !b) return 0
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime())/1000)
}

const totalSeconds = computed(() => entries.value.reduce((s, e) => s + secondsBetween(e.clock_in_at, e.clock_out_at), 0))
const totalAmount = computed(() => entries.value.reduce((s, e) => s + Number(e.amount || 0), 0))

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h}h ${m}m ${s}s`
}

const formatDateTime = (iso) => new Date(iso).toLocaleString('en-CL', { timeZone: 'America/Santiago' })
const formatCurrency = (n) => {
  const symbol = auth.user?.currencySymbol || 'S/'
  return `${symbol} ${(Number(n)||0).toFixed(2)}`
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
    list.push({ date: d, dateStr, label: d.getDate(), shift: null })
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
  const res = await api.getMyEntries(start, end)
  if (res.success) {
    entries.value = res.data
    period.value = res.period
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
</script>

<style scoped>
</style>

